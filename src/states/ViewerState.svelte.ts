import { setContext, getContext } from "svelte";

export interface NavigationSignal {
  page: number;
  source: "program" | "scroll" | "init";
}

/**
 * ビューアー内の表示状態およびナビゲーションを統括するステート管理クラス
 */
export class ViewerState {
  currentPage = $state(1);
  totalPages = $state(0);
  currentZoom = $state(1.0);
  currentMode = $state<"ORIGINAL" | "CUSTOM" | "FIT_HEIGHT" | "FIT_WIDTH">(
    "FIT_HEIGHT",
  );

  /**
   * スクロール制御の無限ループを防ぐための駆動ソース分離シグナル
   */
  navigationSignal = $state<NavigationSignal>({ page: 1, source: "init" });

  zoomPercentage = $derived(`${Math.round(this.currentZoom * 100)}%`);

  /**
   * ボタンや入力変更など、プログラム側から明示的にページを切り替える
   */
  goToPage(page: number): void {
    if (page < 1 || (this.totalPages > 0 && page > this.totalPages)) return;
    this.currentPage = page;
    this.navigationSignal = { page, source: "program" };
  }

  /**
   * 手動スクロールによるページ検知時に、内部状態のみを同期する（再スクロールは誘発させない）
   */
  updatePageFromScroll(page: number): void {
    if (this.currentPage === page) return;
    this.currentPage = page;
    this.navigationSignal = { page, source: "scroll" };
  }

  updateLayout(vW: number, vH: number, baseW: number, baseH: number): void {
    if (this.currentMode === "ORIGINAL") {
      this.currentZoom = 1.0;
    } else if (this.currentMode === "FIT_WIDTH") {
      this.currentZoom = vW / baseW;
    } else if (this.currentMode === "FIT_HEIGHT") {
      let scale = vH / baseH;
      if (baseW * scale > vW) {
        scale = vW / baseW;
      }
      this.currentZoom = scale;
    }
  }
}

const VIEWER_STATE_KEY = Symbol("VIEWER_STATE");

export function initViewerState(): ViewerState {
  const state = new ViewerState();
  setContext(VIEWER_STATE_KEY, state);
  return state;
}

export function getViewerState(): ViewerState {
  const state = getContext<ViewerState>(VIEWER_STATE_KEY);
  if (!state) {
    throw new Error("ViewerState has not been initialized.");
  }
  return state;
}
