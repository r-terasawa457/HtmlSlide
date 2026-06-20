<script lang="ts">
  /**
   * @component ControlBar
   * @description 画面上部に表示されるコントロールツールバー。
   * ページの遷移、表示倍率の変更、表示モードの切り替え、およびレーザーポインターのON/OFF制御UIを提供します。
   */
  import { getAppState } from "../../states/AppState.svelte";
  import { getViewerState } from "../../states/ViewerState.svelte";
  import { AssetProvider } from "../../scripts/AssetProvider";
  import { PptxExportController } from "../../scripts/pptxExportController";

  const appState = getAppState();
  const viewerState = getViewerState();
  let isExporting = $state(false);

  function handlePageChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      viewerState.goToPage(val);
    }
  }

  function handleZoomIn() {
    viewerState.zoomMode = "CUSTOM";
    viewerState.currentZoom += 0.1;
  }

  function handleZoomOut() {
    viewerState.zoomMode = "CUSTOM";
    viewerState.currentZoom = Math.max(0.1, viewerState.currentZoom - 0.1);
  }

  function setZoomMode(mode: typeof viewerState.zoomMode) {
    viewerState.zoomMode = mode;
  }

  function handleModeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    viewerState.switchViewMode(target.value as any);
  }

  async function handleExportPptx() {
    const title = appState.title || "presentation";
    const fileName = `${title}.pptx`;
    isExporting = true;

    try {
      await PptxExportController.export({
        slidesHtml: appState.slidesHtml,
        fileName,
      });
      alert("PPTXのエクスポートが完了しました。");
    } catch (err: any) {
      alert(`PPTXのエクスポートに失敗しました:\n${err.message || String(err)}`);
    } finally {
      isExporting = false;
    }
  }

  async function handleOpenStageView() {
    const stageUrl = await AssetProvider.resolveCompositeHtmlUrl("/src/entrypoint/stage_view.html");
    const width = 1280;
    const height = 720;

    viewerState.stageWindow = window.open(
      stageUrl,
      "stageWin",
      `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`,
    );
  }
</script>

<div class={viewerState.isMainFullscreen ? "fullscreen-toolbar-container" : ""}>
  <div id="toolbar" class="h-12 min-h-12 bg-[#323639] color-white flex items-center justify-between px-4 shadow-[0_2px_5px_rgba(0,0,0,0.3)] relative z-50 select-none">
    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1">
        <select 
          value={viewerState.currentMode} 
          onchange={handleModeChange}
          class="bg-[#202124] text-white border border-[#5f6368] rounded px-2 py-1 text-sm outline-none cursor-pointer focus:border-[#4285f4]"
        >
          <option value="SCROLL">スクロール表示</option>
          <option value="STANDALONE_PRES">スライド表示（単一窓）</option>
          <option value="CONSOLE_PRES">プレゼンタービュー（2画面）</option>
        </select>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <div class="flex items-center gap-1 text-sm text-white">
        <input
          type="number"
          class="w-12 bg-[#202124] border border-[#5f6368] rounded px-1 text-center text-white outline-none focus:border-[#4285f4]"
          value={viewerState.currentPage}
          onchange={handlePageChange}
          min="1"
          max={viewerState.totalPages}
        />
        <span class="text-gray-400">/ {viewerState.totalPages}</span>
      </div>

      <div class="w-px h-5 bg-[#5f6368] mx-2"></div>

      <div class="flex items-center gap-1">
        <button onclick={handleZoomOut} title="縮小" class="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors">
          <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z" /></svg>
        </button>
        <span class="w-14 text-center text-sm text-white">{viewerState.zoomPercentage}</span>
        <button onclick={handleZoomIn} title="拡大" class="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors">
          <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg>
        </button>
      </div>

      <div class="w-px h-5 bg-[#5f6368] mx-2"></div>

      <div class="flex items-center gap-0.5">
        <button
          onclick={() => setZoomMode("ORIGINAL")}
          title="等倍 (100%)"
          class="p-1.5 rounded transition-colors {viewerState.zoomMode === 'ORIGINAL' ? 'bg-[rgba(66,133,244,0.2)]' : 'hover:bg-[rgba(255,255,255,0.1)]'}"
        >
          <svg class="w-5 h-5 {viewerState.zoomMode === 'ORIGINAL' ? 'fill-[#4285f4]' : 'fill-white'}" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM12 7h-2v3H7v2h3v3h2v-3h3v-2h-3V7z"/></svg>
        </button>
        <button
          onclick={() => setZoomMode("FIT_HEIGHT")}
          title="高さ合わせ"
          class="p-1.5 rounded transition-colors {viewerState.zoomMode === 'FIT_HEIGHT' ? 'bg-[rgba(66,133,244,0.2)]' : 'hover:bg-[rgba(255,255,255,0.1)]'}"
        >
          <svg class="w-5 h-5 {viewerState.zoomMode === 'FIT_HEIGHT' ? 'fill-[#4285f4]' : 'fill-white'}" viewBox="0 0 24 24"><path d="M13 2v20h-2V2h2zM5 10l2-2 2 2H5zm0 4l2 2 2-2H5zm14-4l-2-2-2 2h4zm0 4l-2 2-2-2h4z" /></svg>
        </button>
        <button
          onclick={() => setZoomMode("FIT_WIDTH")}
          title="幅合わせ"
          class="p-1.5 rounded transition-colors {viewerState.zoomMode === 'FIT_WIDTH' ? 'bg-[rgba(66,133,244,0.2)]' : 'hover:bg-[rgba(255,255,255,0.1)]'}"
        >
          <svg class="w-5 h-5 {viewerState.zoomMode === 'FIT_WIDTH' ? 'fill-[#4285f4]' : 'fill-white'}" viewBox="0 0 24 24"><path d="M2 13h20v-2H2v2zM10 5l-2 2 2 2V5zm4 0l2 2-2 2V5zm10 14l-2-2 2-2v4zm4 0l2-2-2-2v4z" /></svg>
        </button>

        <button
          onclick={() => viewerState.laserActive = !viewerState.laserActive}
          title={viewerState.laserActive ? "レーザーポインターをオフ" : "レーザーポインターをオン"}
          class="p-1.5 rounded transition-colors ml-1 {viewerState.laserActive ? 'bg-[rgba(255,23,68,0.2)]' : 'hover:bg-[rgba(255,255,255,0.1)]'}"
        >
          <svg class="w-5 h-5 {viewerState.laserActive ? 'fill-[#ff1744]' : 'fill-white'}" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="6" />
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke={viewerState.laserActive ? "#ff1744" : "#ffffff"} stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <button onclick={handleExportPptx} disabled={isExporting} title={isExporting ? "PPTX生成中..." : "PPTXに出力"} class="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] disabled:opacity-40 transition-colors">
        <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H10v-4H7l5-5 5 5h-3v4z" /></svg>
      </button>
      <button onclick={handleOpenStageView} title="プロジェクター・別窓表示" class="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors">
        <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" /></svg>
      </button>
      <button onclick={() => appState.requestPrint()} title="PDF印刷印刷（Ctrl+P）" class="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors">
        <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" /></svg>
      </button>
      <button onclick={() => viewerState.toggleMainFullscreen()} title="全画面表示" class="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors">
        {#if viewerState.isMainFullscreen}
          <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>
        {:else}
          <svg class="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .fullscreen-toolbar-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 48px;
    z-index: 100;
    transition: height 0.2s ease;
  }

  .fullscreen-toolbar-container #toolbar {
    opacity: 0;
    transform: translateY(-100%);
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: none;
  }

  .fullscreen-toolbar-container:hover {
    height: 48px;
  }

  .fullscreen-toolbar-container:hover #toolbar {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
</style>