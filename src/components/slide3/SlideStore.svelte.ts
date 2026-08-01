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
   * 表示対象のページ（renderPages）のみが gap を挟んで縦一列に並んでいると仮定した場合の、
   * 全体のトータルサイズ（最大幅と合計高さ）を計算します。
   *
   * @param renderPages レンダリング対象のページインデックスの配列、またはすべてを対象とする場合は "__all__"
   * @param gap ページ間の隙間（ピクセル数）
   * @returns 計算されたトータルサイズ（width と height）。表示対象のページが存在しない、または計算できない場合は undefined
   */
  calculateTotalSize(
    renderPages: number[] | "__all__" | undefined = "__all__",
    gap: number = 0,
  ): PageSize | undefined {
    const pages = this._slideMeta.pageSizesPredicted;
    if (!pages || pages.length === 0) return undefined;

    const renderSet = renderPages !== "__all__" ? new Set(renderPages) : null;

    let maxWidth = 0;
    let totalHeight = 0;
    let isFirstRenderedPage = true;
    let hasRenderedPage = false;

    for (let i = 0; i < pages.length; i++) {
      if (renderSet && !renderSet.has(i)) {
        continue;
      }

      const page = pages[i];
      if (page === undefined) {
        continue;
      }

      if (!isFirstRenderedPage) {
        totalHeight += gap;
      }
      isFirstRenderedPage = false;
      hasRenderedPage = true;

      totalHeight += page.height;
      maxWidth = Math.max(maxWidth, page.width);
    }

    if (!hasRenderedPage) {
      return undefined;
    }

    return {
      width: maxWidth,
      height: totalHeight,
    };
  }

  /**
   * 現在のスクロール位置とビューポートの高さから、アクティブなページ番号（0開始）を判定します。
   * 画面内での表示面積（縦方向のピクセル数）が最も大きいページを現在のページとみなします。
   * レンダリング対象のページ（renderPages）のみが gap を挟んで縦一列に並んでいるものとして計算します。
   *
   * @param scrollTop 現在のスクロールコンテナのトップ位置
   * @param viewportHeight (スケール1.0換算)ビューポート（表示領域）の高さ
   * @param renderPages レンダリング対象のページインデックスの配列、またはすべてを対象とする場合は "__all__"
   * @param gap ページ間の隙間（ピクセル数）
   * @returns 現在のページインデックス（0 〜 ページ数-1）。判定できない場合は undefined
   */
  calculateCurrentPageIndex(
    scrollTop: number,
    viewportHeight: number,
    renderPages: number[] | "__all__" | undefined = "__all__",
    gap: number = 0,
  ): number | undefined {
    const pages = this._slideMeta.pageSizesPredicted;
    if (!pages || pages.length === 0) return undefined;

    let maxVisibleHeight = -1;
    let activeIndex: number | undefined = undefined;
    let accumulatedTop = 0;

    const renderSet = renderPages !== "__all__" ? new Set(renderPages) : null;
    let isFirstRenderedPage = true;

    for (let i = 0; i < pages.length; i++) {
      if (renderSet && !renderSet.has(i)) {
        continue;
      }

      const page = pages[i];
      if (page === undefined) {
        continue;
      }

      if (!isFirstRenderedPage) {
        accumulatedTop += gap;
      }
      isFirstRenderedPage = false;

      const pageHeight = page.height;
      const pageTop = accumulatedTop;
      const pageBottom = pageTop + pageHeight;

      const intersectionStart = Math.max(scrollTop, pageTop);
      const intersectionEnd = Math.min(scrollTop + viewportHeight, pageBottom);
      const visibleHeight = Math.max(0, intersectionEnd - intersectionStart);

      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        activeIndex = i;
      }

      accumulatedTop += pageHeight;
    }

    return activeIndex;
  }

  /**
   * 指定されたページがビューポートの最上部に表示されるための scrollTop 位置を計算します。
   * レンダリング対象のページ（renderPages）のみが gap を挟んで縦一列に並んでいるものとして計算します。
   *
   * @param pageIndex 対象のページインデックス（0 〜 ページ数-1）
   * @param viewportHeight (スケール1.0換算)ビューポート（表示領域）の高さ
   * @param renderPages レンダリング対象のページインデックスの配列、またはすべてを対象とする場合は "__all__"
   * @param gap ページ間の隙間（ピクセル数）
   * @returns ターゲットとなる scrollTop のピクセル位置。計算できない場合は undefined
   */
  calculateScrollTop(
    pageIndex: number,
    viewportHeight: number,
    renderPages: number[] | "__all__" | undefined = "__all__",
    gap: number = 0,
  ): number | undefined {
    const pages = this._slideMeta.pageSizesPredicted;
    if (
      !pages ||
      pages.length === 0 ||
      pageIndex < 0 ||
      pageIndex >= pages.length
    ) {
      return undefined;
    }

    const renderSet = renderPages !== "__all__" ? new Set(renderPages) : null;

    if (renderSet && !renderSet.has(pageIndex)) {
      return undefined;
    }

    let targetScrollTop = 0;
    let displayedTotalHeight = 0;
    let isFirstRenderedPage = true;

    for (let i = 0; i < pages.length; i++) {
      if (renderSet && !renderSet.has(i)) {
        continue;
      }

      const page = pages[i];
      if (page === undefined) {
        continue;
      }

      if (!isFirstRenderedPage) {
        if (i <= pageIndex) {
          targetScrollTop += gap;
        }
        displayedTotalHeight += gap;
      }
      isFirstRenderedPage = false;

      if (i < pageIndex) {
        targetScrollTop += page.height;
      }
      displayedTotalHeight += page.height;
    }

    const maxScrollTop = Math.max(0, displayedTotalHeight - viewportHeight);

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
