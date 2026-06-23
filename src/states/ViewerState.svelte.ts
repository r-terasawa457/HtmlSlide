import { setContext, getContext } from "svelte";
import { getAppState } from "./AppState.svelte";
import type { ParsedSlideData } from "../components/Slide/types";

export type ViewMode = "SCROLL" | "STANDALONE_PRES" | "CONSOLE_PRES";
export type ZoomMode = "ORIGINAL" | "CUSTOM" | "FIT_HEIGHT" | "FIT_WIDTH";
export type StageDisplayMode = "CLONE" | "SLIDE";

export interface ModeContext {
  scrollTop: number;
  scrollLeft: number;
  currentPage: number;
  unscaledCenterTop: number;
  unscaledCenterLeft: number;
  unscaledViewportWidth: number;
  unscaledViewportHeight: number;
}

/**
 * .slides を含む生HTML文字列を構造化された ParsedSlideData にパースします。
 */
export function parseSlidesHtml(html: string): ParsedSlideData {
  if (!html) {
    return { containerAttrs: {}, commons: [], pages: [] };
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const slidesDiv = doc.querySelector(".slides");
  if (!slidesDiv) {
    return { containerAttrs: {}, commons: [], pages: [] };
  }

  const containerAttrs: Record<string, string> = {};
  for (const attr of Array.from(slidesDiv.attributes)) {
    containerAttrs[attr.name] = attr.value;
  }

  const commons: string[] = [];
  const pages: string[] = [];

  for (const child of Array.from(slidesDiv.childNodes)) {
    if (child.nodeType === 1) {
      const element = child as HTMLElement;
      if (
        element.tagName.toLowerCase() === "section" &&
        element.classList.contains("page")
      ) {
        pages.push(element.outerHTML);
      } else {
        commons.push(element.outerHTML);
      }
    } else if (child.nodeType === 3) {
      const text = child.textContent?.trim();
      if (text) {
        commons.push(text);
      }
    }
  }

  return { containerAttrs, commons, pages };
}

/**
 * @class ViewerState
 * @description アプリケーションの画面表示モード、ズーム、およびレーザーポインターを含む全画面同期状態を統括管理する状態クラス。
 */
export class ViewerState {
  private appState = getAppState();

  currentMode = $state<ViewMode>("SCROLL");
  zoomMode = $state<ZoomMode>("FIT_HEIGHT");

  /** 各表示モードごとのスクロール・ページ状態の管理（scrollLeftを初期値に追加） */
  modeContexts = $state<Record<ViewMode, ModeContext>>({
    SCROLL: {
      scrollTop: 0,
      scrollLeft: 0,
      currentPage: 1,
      unscaledCenterTop: 0,
      unscaledCenterLeft: 0,
      unscaledViewportWidth: 0,
      unscaledViewportHeight: 0,
    },
    STANDALONE_PRES: {
      scrollTop: 0,
      scrollLeft: 0,
      currentPage: 1,
      unscaledCenterTop: 0,
      unscaledCenterLeft: 0,
      unscaledViewportWidth: 0,
      unscaledViewportHeight: 0,
    },
    CONSOLE_PRES: {
      scrollTop: 0,
      scrollLeft: 0,
      currentPage: 1,
      unscaledCenterTop: 0,
      unscaledCenterLeft: 0,
      unscaledViewportWidth: 0,
      unscaledViewportHeight: 0,
    },
  });

  stageWindow = $state<Window | null>(null);
  stageDisplayMode = $state<StageDisplayMode>("SLIDE");
  currentZoom = $state(1.0);
  isMainApiFullscreen = $state(false);
  isMainNativeFullscreen = $state(false);

  laserActive = $state(false);
  laserX = $state(0);
  laserY = $state(0);

  isMainFullscreen = $derived(
    this.isMainApiFullscreen || this.isMainNativeFullscreen,
  );

  navigationSignal = $state<{
    page: number;
    source: "program" | "scroll" | "init";
  }>({
    page: 1,
    source: "init",
  });

  get slideData(): ParsedSlideData {
    return parseSlidesHtml(this.appState.slidesHtml);
  }

  get totalPages(): number {
    return this.slideData.pages.length;
  }

  currentPage = $derived(this.modeContexts[this.currentMode].currentPage);

  get currentPageIndex(): number {
    return this.modeContexts[this.currentMode].currentPage - 1;
  }

  set currentPageIndex(index: number) {
    const page = index + 1;
    if (page < 1 || page > this.totalPages) return;
    if (this.modeContexts[this.currentMode].currentPage === page) return;
    this.modeContexts[this.currentMode].currentPage = page;
  }

  zoomPercentage = $derived(`${Math.round(this.currentZoom * 100)}%`);

  /**
   * 外部プロジェクターウィンドウへ一方向同期するための統合メッセージペイロード。
   * MainがSCROLLの時は、Stage側も自動的にSCROLL表示にし、縦・横双方のスクロール位置を完全に同期させます。
   */
  stageSyncData = $derived({
    type: "sync_stage",
    renderMode: this.currentMode === "SCROLL" ? "SCROLL" : "SLIDE",
    currentPage: this.currentPage,
    currentZoom: this.currentZoom,
    data: this.slideData,
    laserState: {
      active: this.laserActive,
      x: this.laserX,
      y: this.laserY,
    },
    unscaledViewport: {
      centerTop: this.modeContexts[this.currentMode].unscaledCenterTop,
      centerLeft: this.modeContexts[this.currentMode].unscaledCenterLeft,
      width: this.modeContexts[this.currentMode].unscaledViewportWidth,
      height: this.modeContexts[this.currentMode].unscaledViewportHeight,
    },
  });

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.modeContexts[this.currentMode].currentPage = page;
    this.navigationSignal = { page, source: "program" };
  }

  changePageRelative(delta: number): void {
    this.goToPage(this.currentPage + delta);
  }

  updatePageFromScroll(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    if (this.modeContexts[this.currentMode].currentPage === page) return;
    this.modeContexts[this.currentMode].currentPage = page;
    this.navigationSignal = { page, source: "scroll" };
  }

  updateScrollTop(scrollTop: number): void {
    this.modeContexts[this.currentMode].scrollTop =
      scrollTop / (this.currentZoom || 1.0);
  }

  updateScrollLeft(scrollLeft: number): void {
    this.modeContexts[this.currentMode].scrollLeft =
      scrollLeft / (this.currentZoom || 1.0);
  }

  switchViewMode(mode: ViewMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.navigationSignal = {
      page: this.modeContexts[mode].currentPage,
      source: "program",
    };
  }

  toggleMainFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Failed to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  updateMainFullscreenState(): void {
    this.isMainApiFullscreen = !!document.fullscreenElement;
    this.isMainNativeFullscreen =
      window.matchMedia("(display-mode: fullscreen)").matches &&
      !this.isMainApiFullscreen;
  }

  /** メイン側の等倍ビューポート状態を更新 */
  updateUnscaledViewport(
    centerTop: number,
    centerLeft: number,
    width: number,
    height: number,
  ): void {
    const ctx = this.modeContexts[this.currentMode];
    ctx.unscaledCenterTop = centerTop;
    ctx.unscaledCenterLeft = centerLeft;
    ctx.unscaledViewportWidth = width;
    ctx.unscaledViewportHeight = height;
  }
}

const VIEWER_STATE_KEY = Symbol("VIEWER_STATE");

export function initViewerState(): ViewerState {
  const state = new ViewerState();
  setContext(VIEWER_STATE_KEY, state);
  return state;
}

export function getViewerState(): ViewerState {
  return getContext<ViewerState>(VIEWER_STATE_KEY);
}
