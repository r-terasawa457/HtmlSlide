import { setContext, getContext } from "svelte";

export type ViewMode = "SCROLL" | "STANDALONE_PRES" | "CONSOLE_PRES";
export type ZoomMode = "ORIGINAL" | "CUSTOM" | "FIT_HEIGHT" | "FIT_WIDTH";
export type StageDisplayMode = "CLONE" | "SLIDE";

export interface ModeContext {
  scrollTop: number;
  currentPage: number;
}

/**
 * @class ViewerState
 * @description アプリケーションの画面表示モード、ズーム、および外部ステージウィンドウへの同期状態を統括管理する状態クラス。
 */
export class ViewerState {
  /** 親ウィンドウの現在の画面表示モード */
  currentMode = $state<ViewMode>("SCROLL");

  /** スライドの表示倍率（フィット）モード */
  zoomMode = $state<ZoomMode>("FIT_HEIGHT");

  /** 各表示モードにおける独立したスクロール位置およびページ番号の記憶領域 */
  modeContexts = $state<Record<ViewMode, ModeContext>>({
    SCROLL: { scrollTop: 0, currentPage: 1 },
    STANDALONE_PRES: { scrollTop: 0, currentPage: 1 },
    CONSOLE_PRES: { scrollTop: 0, currentPage: 1 },
  });

  /** ステージビュー（外部表示専用ウィンドウ）の Window オブジェクト参照 */
  stageWindow = $state<Window | null>(null);

  /** 親がSCROLLモードのときのステージビューの表示形式設定 */
  stageDisplayMode = $state<StageDisplayMode>("SLIDE");

  /** スライドの総ページ数 */
  totalPages = $state(0);

  /** 現在適用されている実際のズームスケール倍率 */
  currentZoom = $state(1.0);

  /** 描画コンポーネントへスクロール位置やページの強制変更命令を媒介するシグナル */
  navigationSignal = $state<{
    page: number;
    source: "program" | "scroll" | "init";
  }>({
    page: 1,
    source: "init",
  });

  /** 現在の表示モードにおいてアクティブなページ番号 */
  currentPage = $derived(this.modeContexts[this.currentMode].currentPage);

  /** ツールバー表示用のズームパーセンテージ文字列 */
  zoomPercentage = $derived(`${Math.round(this.currentZoom * 100)}%`);

  /** ステージビュー（外部画面）へ一方向同期するために最適化された送信メッセージデータ */
  stageSyncData = $derived({
    type: "sync_stage",
    renderMode:
      this.currentMode === "SCROLL" && this.stageDisplayMode === "CLONE"
        ? "SCROLL"
        : "SLIDE",
    currentPage: this.currentPage,
    scrollTop: this.modeContexts[this.currentMode].scrollTop,
    currentZoom: this.currentZoom,
  });

  /**
   * 指定したページへ表示を切り替えます。
   * @param page - 遷移先のページ番号
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.modeContexts[this.currentMode].currentPage = page;
    this.navigationSignal = { page, source: "program" };
  }

  /**
   * 現在のページ番号を相対的に移動させます。
   * @param delta - 移動するページ数（正負値）
   */
  changePageRelative(delta: number): void {
    this.goToPage(this.currentPage + delta);
  }

  /**
   * スクロールイベントによって検出されたページ番号を現在のコンテキストに反映します。
   * @param page - 検出されたページ番号
   */
  updatePageFromScroll(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    if (this.modeContexts[this.currentMode].currentPage === page) return;
    this.modeContexts[this.currentMode].currentPage = page;
    this.navigationSignal = { page, source: "scroll" };
  }

  /**
   * 現在の表示モードにおけるコンテナのスクロール位置を退避・更新します。
   * @param scrollTop - 現在のコンテナのスクロール上端位置(px)
   */
  updateScrollTop(scrollTop: number): void {
    this.modeContexts[this.currentMode].scrollTop = scrollTop;
  }

  /**
   * 親ウィンドウの表示モードを切り替えます。
   * @param mode - 変更後の表示モード
   */
  switchViewMode(mode: ViewMode): void {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.navigationSignal = {
      page: this.modeContexts[mode].currentPage,
      source: "program",
    };
  }

  /**
   * 表示コンテナの現在の寸法およびズームモードから適切なスケール倍率を再計算します。
   * @param containerWidth - ビューアコンテナのクライアント幅(px)
   * @param containerHeight - ビューアコンテナのクライアント高(px)
   * @param baseWidth - スライドの論理基準幅(px)
   * @param baseHeight - スライドの論理基準高(px)
   */
  updateLayout(
    containerWidth: number,
    containerHeight: number,
    baseWidth: number,
    baseHeight: number,
  ): void {
    switch (this.zoomMode) {
      case "ORIGINAL":
        this.currentZoom = 1.0;
        break;
      case "FIT_WIDTH":
        this.currentZoom = containerWidth / baseWidth;
        break;
      case "FIT_HEIGHT":
        this.currentZoom = containerHeight / baseHeight;
        break;
      case "CUSTOM":
        break;
    }
  }
}

const VIEWER_STATE_KEY = Symbol("VIEWER_STATE");

/**
 * 閲覧状態（ViewerState）のシングルトンインスタンスを初期化し、コンテキストに登録します。
 * @returns {ViewerState} 初期化された状態インスタンス
 */
export function initViewerState(): ViewerState {
  const state = new ViewerState();
  setContext(VIEWER_STATE_KEY, state);
  return state;
}

/**
 * コンテキストから閲覧状態（ViewerState）のインスタンスを取得します。
 * @returns {ViewerState} 解決された状態インスタンス
 */
export function getViewerState(): ViewerState {
  return getContext<ViewerState>(VIEWER_STATE_KEY);
}
