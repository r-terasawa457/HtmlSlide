import { setContext, getContext } from "svelte";

export interface PageSize {
  readonly width: number;
  readonly height: number;
}
export interface SlideData {
  readonly containerAttrs: Readonly<Record<string, string>>;
  readonly commonElements: readonly string[];
  readonly pageElements: readonly string[];
}

export interface SlideMeta {
  readonly pageSizes: (PageSize | undefined)[];
  readonly pageSizesPredicted: PageSize[] | undefined;
  readonly pageLength: number | undefined;
  readonly totalSize: PageSize | undefined;
}

interface EditablePageSize {
  width: number;
  height: number;
}
interface EditableSlideData {
  containerAttrs: Record<string, string>;
  commonElements: string[];
  pageElements: string[];
}
interface EditableSlideMeta {
  pageSizes: (EditablePageSize | undefined)[];
  pageSizesPredicted: PageSize[] | undefined;
  pageLength: number | undefined;
  totalSize: EditablePageSize | undefined;
}

const nullSlideData = (): EditableSlideData => ({
  containerAttrs: {},
  commonElements: [],
  pageElements: [],
});
const nullSlideMeta = (): EditableSlideMeta => ({
  pageSizes: [],
  pageSizesPredicted: undefined,
  pageLength: undefined,
  totalSize: undefined,
});

/**
 * .slides を含む生HTML文字列を構造化された SlideData にパースします。
 */
function parseSlidesHtml(html: string): [EditableSlideData, EditableSlideMeta] {
  if (!html) {
    return [nullSlideData(), nullSlideMeta()];
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const slidesDiv = doc.querySelector(".slides");
  if (!slidesDiv) {
    return [nullSlideData(), nullSlideMeta()];
  }

  const containerAttrs: Record<string, string> = {};
  for (const attr of Array.from(slidesDiv.attributes)) {
    containerAttrs[attr.name] = attr.value;
  }

  const commonElements: string[] = [];
  const pageElements: string[] = [];

  for (const child of Array.from(slidesDiv.childNodes)) {
    if (child.nodeType === 1) {
      const element = child as HTMLElement;
      if (
        element.tagName.toLowerCase() === "section" &&
        element.classList.contains("page")
      ) {
        pageElements.push(element.outerHTML);
      } else {
        commonElements.push(element.outerHTML);
      }
    } else if (child.nodeType === 3) {
      const text = child.textContent?.trim();
      if (text) {
        commonElements.push(text);
      }
    }
  }
  const pageLength = pageElements.length;

  return [
    {
      containerAttrs,
      commonElements,
      pageElements,
    },
    {
      pageLength,
      pageSizes: Array(pageLength).fill(undefined),
      pageSizesPredicted: undefined,
      totalSize: undefined,
    },
  ];
}
class SlideDataStore {
  // slideHTMLRawString: string | undefined = undefined
  private _slideData: EditableSlideData = $state(nullSlideData());
  private _slideMeta: EditableSlideMeta = $state(nullSlideMeta());

  setSlideFromHtmlRawString(htmlText: string): void {
    [this._slideData, this._slideMeta] = parseSlidesHtml(htmlText);
  }

  get slideData(): SlideData {
    return this._slideData;
  }
  get slideMeta(): SlideMeta {
    return this._slideMeta;
  }

  setPageSizes(pageSizes: Record<number, PageSize>): void {
    const newPageSizes = [...this._slideMeta.pageSizes];
    let isChange = false;

    for (const keyString of Object.keys(pageSizes)) {
      const i = Number(keyString);
      if (i >= newPageSizes.length) continue;

      if (
        newPageSizes[i]?.height == pageSizes[i]?.height &&
        newPageSizes[i]?.width === pageSizes[i]?.height
      )
        continue;

      newPageSizes[i] = pageSizes[i];
      isChange = true;
    }
    if (!isChange) return;
    this._slideMeta.pageSizes = newPageSizes;
    this.setPredictedSizesAndTotal();
  }

  private setPredictedSizesAndTotal(): void {
    const sizes = this._slideMeta.pageSizes;
    if (sizes === undefined) {
      this._slideMeta.pageSizesPredicted = undefined;
      this._slideMeta.totalSize = undefined;
      return;
    }

    const newPageSizes = [...sizes];

    let lastSize: EditablePageSize = { height: 0, width: 0 };
    let udIdx = newPageSizes.length - 1;
    for (let i = sizes.length - 1; i >= 0; i--) {
      const currentSize = sizes[i];
      if (currentSize === undefined) {
        if (udIdx === -1) {
          udIdx = i;
        }
        continue;
      }

      for (let j = i; j <= udIdx; j++) {
        newPageSizes[j] = { ...currentSize };
      }
      udIdx = -1;
      lastSize = currentSize;
    }
    if (udIdx !== -1 && lastSize !== undefined) {
      for (let j = 0; j <= udIdx; j++) {
        newPageSizes[j] = { ...lastSize };
      }
    }
    this._slideMeta.pageSizesPredicted = newPageSizes as PageSize[]; // undefind混入がないか慎重に確認すること

    this._slideMeta.totalSize = this._slideMeta.pageSizesPredicted?.reduce(
      (acc, page) => ({
        width: Math.max(acc.width, page.width),
        height: acc.height + page.height,
      }),
      { width: 0, height: 0 },
    );
  }

  /**
   * 現在のスクロール位置とビューポートの高さから、アクティブなページ番号（0開始）を判定します。
   * 画面内での表示面積（縦方向のピクセル数）が最も大きいページを現在のページとみなします。
   *
   * @param scrollTop 現在のスクロールコンテナのトップ位置
   * @param viewportHeight (スケール1.0換算)ビューポート（表示領域）の高さ
   * @returns 現在のページインデックス（0 〜 ページ数-1）。判定できない場合は undefind
   */
  culculateCurrentPageIndex(
    scrollTop: number,
    viewportHeight: number,
  ): number | undefined {
    const pages = this._slideMeta.pageSizesPredicted;
    if (!pages || pages.length === 0) return undefined;

    let maxVisibleHeight = -1;
    let activeIndex: number | undefined = undefined;
    let accumulatedTop = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (page === undefined) {
        continue;
      }
      const pageHeight = page.height;
      const pageTop = accumulatedTop;
      const pageBottom = pageTop + pageHeight;

      // 1. ビューポートとページが重なっている領域（交差部分）の開始位置と終了位置を計算
      const intersectionStart = Math.max(scrollTop, pageTop);
      const intersectionEnd = Math.min(scrollTop + viewportHeight, pageBottom);

      // 2. 重なっている縦幅（ピクセル数）を計算
      const visibleHeight = Math.max(0, intersectionEnd - intersectionStart);

      // 3. 最も多く画面に表示されているページを更新
      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        activeIndex = i;
      }

      // 次のページのトップ位置を更新
      accumulatedTop += pageHeight;
    }

    return activeIndex;
  }
  /**
   * 指定されたページがビューポートの最上部に表示されるための scrollTop 位置を計算します。
   *
   * @param pageIndex 対象のページインデックス（0 〜 ページ数-1）
   * @returns ターゲットとなる scrollTop のピクセル位置。計算できない場合は undefined
   */
  calculateScrollTop(
    pageIndex: number,
    viewportHeight: number,
  ): number | undefined {
    const pages = this._slideMeta.pageSizesPredicted;
    const totalSize = this._slideMeta.totalSize;

    if (
      !pages ||
      pages.length === 0 ||
      !totalSize ||
      pageIndex < 0 ||
      pageIndex >= pages.length
    ) {
      return undefined;
    }

    let targetScrollTop = 0;

    // 1. 指定されたページの直前までの高さをすべて足し合わせる
    for (let i = 0; i < pageIndex; i++) {
      const page = pages[i];
      if (page === undefined) {
        continue;
      }
      targetScrollTop += page.height;
    }
    const maxScrollTop = Math.max(0, totalSize.height - viewportHeight);

    return Math.min(targetScrollTop, maxScrollTop);
  }
}

const SLIDE_STORE_KEY = Symbol("SLIDE_STORE");

export function initSlideDataStore(): SlideDataStore {
  const state = new SlideDataStore();
  setContext(SLIDE_STORE_KEY, state);
  return state;
}

export function getSlideDataStore(): SlideDataStore {
  return getContext<SlideDataStore>(SLIDE_STORE_KEY);
}
