import { setContext, getContext } from "svelte";

/**
 * アプリケーション全体のライフサイクルおよびドキュメントデータを統括するステート管理クラス
 */
export class AppState {
  isLoaded = $state(false);
  title = $state("");
  slidesHtml = $state("");
  assetsMap = $state<Record<string, string>>({});
  presenterWindow = $state<Window | null>(null);
  isPrintRequested = $state(false);

  /**
   * 印刷要求シグナルを点灯します。
   */
  requestPrint(): void {
    this.isPrintRequested = true;
  }

  /**
   * 印刷要求シグナルを消灯します。
   */
  clearPrintRequest(): void {
    this.isPrintRequested = false;
  }
}

const APP_STATE_KEY = Symbol("APP_STATE");

export function initAppState(): AppState {
  const state = new AppState();
  setContext(APP_STATE_KEY, state);
  return state;
}

export function getAppState(): AppState {
  const state = getContext<AppState>(APP_STATE_KEY);
  if (!state) {
    throw new Error("AppState has not been initialized.");
  }
  return state;
}
