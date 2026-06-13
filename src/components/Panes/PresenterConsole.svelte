<script lang="ts">
  /**
   * @component PresenterConsole
   * @description 発表者専用のコントロールダッシュボード画面。
   * 現在のページのスライドを表示するViewerCoreを中央に配置し、前後のページ切り替えボタンや次のスライド情報の表示などの発表進行用UIを提供します。
   */
  import { getViewerState } from "../../states/ViewerState.svelte";
  import ViewerCore from "../Viewer/ViewerCore.svelte";

  const viewerState = getViewerState();
</script>

<div id="presenter-console-root">
  <div class="console-sidebar">
    <div class="info-panel">
      <h2>Presenter Console</h2>
      <div class="page-counter">
        <span class="current">{viewerState.currentPage}</span>
        <span class="separator">/</span>
        <span class="total">{viewerState.totalPages}</span>
      </div>
    </div>

    <div class="control-panel">
      <button
        onclick={() => viewerState.changePageRelative(-1)}
        disabled={viewerState.currentPage <= 1}
        title="前のページへ"
      >
        ← Prev
      </button>
      <button
        onclick={() => viewerState.changePageRelative(1)}
        disabled={viewerState.currentPage >= viewerState.totalPages}
        title="次のページへ"
      >
        Next →
      </button>
    </div>

    <div class="status-panel">
      <p class="notice">※リソース保護のため、次スライドのライブプレビューは無効化されています。</p>
      {#if viewerState.currentPage < viewerState.totalPages}
        <div class="next-info">
          <span class="label">Next Slide</span>
          <span class="value">Page {viewerState.currentPage + 1}</span>
        </div>
      {:else}
        <div class="next-info end">
          <span class="value">End of Slides</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="console-preview-area">
    <ViewerCore renderMode="SLIDE" interactive={true} currentPage={viewerState.currentPage} />
  </div>
</div>

<style>
  #presenter-console-root {
    display: flex;
    width: 100vw;
    height: 100vh;
    background-color: #1e1e1e;
    color: #ffffff;
    overflow: hidden;
  }

  .console-sidebar {
    width: 320px;
    background-color: #2d2d2d;
    display: flex;
    flex-direction: column;
    padding: 24px;
    box-sizing: border-box;
    border-right: 1px solid #404040;
    gap: 32px;
  }

  .info-panel h2 {
    margin: 0 0 12px 0;
    font-size: 1.1rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888888;
  }

  .page-counter {
    display: flex;
    align-items: baseline;
    gap: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .page-counter .current {
    font-size: 3.5rem;
    font-weight: 700;
    color: #00b0ff;
    line-height: 1;
  }

  .page-counter .separator {
    font-size: 1.8rem;
    color: #555555;
  }

  .page-counter .total {
    font-size: 1.8rem;
    color: #aaaaaa;
  }

  .control-panel {
    display: flex;
    gap: 12px;
  }

  .control-panel button {
    flex: 1;
    padding: 14px;
    font-size: 1rem;
    font-weight: 500;
    background-color: #404040;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s, color 0.15s;
  }

  .control-panel button:hover:not(:disabled) {
    background-color: #505050;
  }

  .control-panel button:disabled {
    background-color: #222222;
    color: #555555;
    cursor: not-allowed;
  }

  .status-panel {
    margin-top: auto;
    background-color: #1a1a1a;
    padding: 16px;
    border-radius: 6px;
    border: 1px solid #333333;
  }

  .status-panel .notice {
    margin: 0 0 12px 0;
    font-size: 0.75rem;
    color: #666666;
    line-height: 1.4;
  }

  .next-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .next-info .label {
    font-size: 0.8rem;
    color: #888888;
  }

  .next-info .value {
    font-size: 1.2rem;
    font-weight: 500;
    color: #e0e0e0;
  }

  .next-info.end .value {
    color: #ff5252;
    font-style: italic;
  }

  .console-preview-area {
    flex: 1;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #111111;
    padding: 32px;
    box-sizing: border-box;
  }
</style>