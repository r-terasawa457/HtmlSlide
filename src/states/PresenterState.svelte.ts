import { setContext, getContext } from "svelte";

export interface PresenterNavigationSignal {
  page: number;
  source: "parent" | "local" | "init";
}

/**
 * プレゼンター画面の表示状態および親ウィンドウとの同期を統括するステート管理クラス
 */
export class PresenterState {
  currentPage = $state(1);
  totalPages = $state(0);
  slidesHtml = $state("");
  slidesCss = $state("");

  /**
   * 親との同期ループや不必要な再スクロールを防ぐための駆動ソース分離シグナル
   */
  navigationSignal = $state<PresenterNavigationSignal>({
    page: 1,
    source: "init",
  });

  /**
   * プレゼンター自身のキー操作によって相対的にページを切り替え、親へ通知する
   */
  changePageRelative(offset: number): void {
    const targetPage = this.currentPage + offset;
    if (targetPage < 1 || (this.totalPages > 0 && targetPage > this.totalPages))
      return;

    this.currentPage = targetPage;
    this.navigationSignal = { page: targetPage, source: "local" };

    if (window.opener) {
      window.opener.postMessage({ type: "sync_page", page: targetPage }, "*");
    }
  }

  /**
   * 親ウィンドウからの同期メッセージを受信した際に内部状態を更新する
   */
  updatePageFromParent(page: number): void {
    if (this.currentPage === page) return;
    this.currentPage = page;
    this.navigationSignal = { page, source: "parent" };
  }
}

const PRESENTER_STATE_KEY = Symbol("PRESENTER_STATE");

export function initPresenterState(): PresenterState {
  const state = new PresenterState();
  setContext(PRESENTER_STATE_KEY, state);
  return state;
}

export function getPresenterState(): PresenterState {
  const state = getContext<PresenterState>(PRESENTER_STATE_KEY);
  if (!state) {
    throw new Error("PresenterState has not been initialized.");
  }
  return state;
}
