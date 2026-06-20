<script lang="ts">
  /**
   * @component PresenterConsole
   * @description 発表者専用のコントロールダッシュボード画面。
   * 現在のページのスライドを表示するViewerCoreを中央に配置し、前後のページ切り替えボタンや次のスライド情報の表示などの発表進行用UIを提供します。
   */
  import type { Snippet } from 'svelte';
  import { getViewerState } from "../../states/ViewerState.svelte";
  import SlideCanvas from "../Slide/SlideCanvas.svelte";

  let { canvas } = $props<{ canvas: Snippet }>();

  const viewerState = getViewerState();
</script>

<div id="presenter-console-root">
  <div class="console-sidebar">
    <div class="info-panel">
      <div class="title-wrapper">
        <button 
          onclick={() => viewerState.switchViewMode("STANDALONE_PRES")} 
          class="back-button"
          title="通常の表示に戻る"
        >
          &lt;
        </button>
        <h2>Presenter Console</h2>
      </div>
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

  <div class="console-preview-container">
    <div class="console-preview-area">
      {@render canvas()}
    </div>

    <div class="mini-control-bar">
      <div class="mini-actions">
        <button 
          onclick={() => viewerState.changePageRelative(-1)} 
          disabled={viewerState.currentPage <= 1}
          title="前のスライド"
          class="mini-btn"
        >
          <svg class="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
        </button>
        
        <span class="mini-page-indicator">
          {viewerState.currentPage} / {viewerState.totalPages}
        </span>

        <button 
          onclick={() => viewerState.changePageRelative(1)} 
          disabled={viewerState.currentPage >= viewerState.totalPages}
          title="次のスライド"
          class="mini-btn"
        >
          <svg class="w-4 h-4 fill-white" viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>

        <div class="mini-divider"></div>

        <button
          onclick={() => viewerState.laserActive = !viewerState.laserActive}
          title={viewerState.laserActive ? "レーザーポインターをオフ" : "レーザーポインターをオン"}
          class="mini-btn laser-toggle-btn"
          class:active={viewerState.laserActive}
        >
          <svg class="w-4 h-4 {viewerState.laserActive ? 'fill-[#ff1744]' : 'fill-white'}" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke={viewerState.laserActive ? "#ff1744" : "#ffffff"} stroke-width="2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  /* スタイル定義は省略（前回の仕様を完全維持） */
  #presenter-console-root { display: flex; width: 100vw; height: 100vh; background-color: #1e1e1e; color: #ffffff; overflow: hidden; }
  .console-sidebar { width: 320px; background-color: #2d2d2d; display: flex; flex-direction: column; padding: 24px; box-sizing: border-box; border-right: 1px solid #404040; gap: 32px; }
  .title-wrapper { display: flex; align-items: center; gap: 12px; margin: 0 0 12px 0; }
  .back-button { background: transparent; border: 1px solid #555555; color: #aaaaaa; border-radius: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-weight: bold; transition: all 0.15s ease; }
  .back-button:hover { background-color: #404040; color: #ffffff; border-color: #888888; }
  .info-panel h2 { margin: 0; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: #888888; }
  .page-counter { display: flex; align-items: baseline; gap: 12px; font-family: ui-monospace, SFMono-Regular, monospace; }
  .page-counter .current { font-size: 3.5rem; font-weight: 700; color: #00b0ff; line-height: 1; }
  .page-counter .separator { font-size: 1.8rem; color: #555555; }
  .page-counter .total { font-size: 1.8rem; color: #aaaaaa; }
  .control-panel { display: flex; gap: 12px; }
  .control-panel button { flex: 1; padding: 14px; font-size: 1rem; font-weight: 500; background-color: #404040; color: #ffffff; border: none; border-radius: 6px; cursor: pointer; transition: background-color 0.15s, color 0.15s; }
  .control-panel button:hover:not(:disabled) { background-color: #505050; }
  .control-panel button:disabled { background-color: #222222; color: #555555; cursor: not-allowed; }
  .status-panel { margin-top: auto; background-color: #1a1a1a; padding: 16px; border-radius: 6px; border: 1px solid #333333; }
  .status-panel .notice { margin: 0 0 12px 0; font-size: 0.75rem; color: #666666; line-height: 1.4; }
  .next-info { display: flex; flex-direction: column; gap: 4px; }
  .next-info .label { font-size: 0.8rem; color: #888888; }
  .next-info .value { font-size: 1.2rem; font-weight: 500; color: #e0e0e0; }
  .next-info.end .value { color: #ff5252; font-style: italic; }
  .console-preview-container { flex: 1; height: 100%; display: flex; flex-direction: column; background-color: #111111; }
  .console-preview-area { flex: 1; display: flex; justify-content: center; align-items: center; padding: 32px 32px 16px 32px; box-sizing: border-box; overflow: hidden; }
  .mini-control-bar { height: 40px; background-color: #252526; border-top: 1px solid #333333; display: flex; align-items: center; justify-content: center; padding: 0 16px; box-sizing: border-box; user-select: none; }
  .mini-actions { display: flex; align-items: center; gap: 8px; }
  .mini-btn { background: transparent; border: none; border-radius: 4px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background-color 0.15s; }
  .mini-btn:hover:not(:disabled) { background-color: rgba(255, 255, 255, 0.1); }
  .mini-btn:disabled { opacity: 0.3; cursor: not-allowed; }
  .mini-page-indicator { font-size: 0.85rem; color: #cccccc; min-width: 60px; text-align: center; font-family: ui-monospace, SFMono-Regular, monospace; }
  .mini-divider { width: 1px; height: 16px; background-color: #444444; margin: 0 4px; }
  .laser-toggle-btn.active { background-color: rgba(255, 23, 68, 0.15); }
  .laser-toggle-btn.active:hover { background-color: rgba(255, 23, 68, 0.25); }
</style>