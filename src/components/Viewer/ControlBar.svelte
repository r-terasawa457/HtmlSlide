<script lang="ts">
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
    viewerState.currentMode = "CUSTOM";
    viewerState.currentZoom += 0.1;
  }

  function handleZoomOut() {
    viewerState.currentMode = "CUSTOM";
    viewerState.currentZoom = Math.max(0.1, viewerState.currentZoom - 0.1);
  }

  function setZoomMode(mode: typeof viewerState.currentMode) {
    viewerState.currentMode = mode;
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

  async function handleOpenPresenter() {
    const presenterUrl = await AssetProvider.resolveCompositeHtmlUrl("src/presenter.html");
    const width = 1280;
    const height = 720;
    appState.presenterWindow = window.open(
      presenterUrl,
      "presWin",
      `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`,
    );
  }
</script>

<div id="toolbar">
  <div class="toolbar-section">
    <span>Slide Presentation</span>
  </div>
  <div class="toolbar-section">
    <div class="toolbar-item">
      <input
        type="number"
        style="width: 40px"
        value={viewerState.currentPage}
        onchange={handlePageChange}
        min="1"
        max={viewerState.totalPages}
      />
      <span>/ <span>{viewerState.totalPages}</span></span>
    </div>
    <div class="separator"></div>
    <div class="toolbar-item">
      <button onclick={handleZoomOut} title="縮小">
        <svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z" /></svg>
      </button>
      <input
        type="text"
        style="width: 50px"
        value={viewerState.zoomPercentage}
        readonly
      />
      <button onclick={handleZoomIn} title="拡大">
        <svg viewBox="0 0 24 24">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      </button>
    </div>
    <div class="separator"></div>
    <div class="toolbar-item">
      <button
        class:active={viewerState.currentMode === "ORIGINAL"}
        onclick={() => setZoomMode("ORIGINAL")}
        title="100%"
      >
        <svg viewBox="0 0 24 24">
          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM12 7h-2v3H7v2h3v3h2v-3h3v-2h-3V7z" />
        </svg>
      </button>
      <button
        class:active={viewerState.currentMode === "CUSTOM"}
        onclick={() => setZoomMode("CUSTOM")}
        title="カスタム"
      >
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z" />
        </svg>
      </button>
      <button
        class:active={viewerState.currentMode === "FIT_HEIGHT"}
        onclick={() => setZoomMode("FIT_HEIGHT")}
        title="高さ合わせ"
      >
        <svg viewBox="0 0 24 24">
          <path d="M13 2v20h-2V2h2zM5 10l2-2 2 2H5zm0 4l2 2 2-2H5zm14-4l-2-2-2 2h4zm0 4l-2 2-2-2h4z" />
        </svg>
      </button>
      <button
        class:active={viewerState.currentMode === "FIT_WIDTH"}
        onclick={() => setZoomMode("FIT_WIDTH")}
        title="幅合わせ"
      >
        <svg viewBox="0 0 24 24">
          <path d="M2 13h20v-2H2v2zM10 5l-2 2 2 2V5zm4 0l2 2-2 2V5zm10 14l-2-2 2-2v4zm4 0l2-2-2-2v4z" />
        </svg>
      </button>
    </div>
  </div>
  <div class="toolbar-section">
    <button onclick={handleExportPptx} disabled={isExporting} title={isExporting ? "PPTX生成中..." : "pptxに出力"}>
      <svg viewBox="0 0 24 24">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H10v-4H7l5-5 5 5h-3v4z" />
      </svg>
    </button>
    <button onclick={handleOpenPresenter} title="プレゼンテーションモード">
      <svg viewBox="0 0 24 24">
        <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
      </svg>
    </button>
    <button onclick={() => appState.requestPrint()} title="印刷">
      <svg viewBox="0 0 24 24">
        <path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z" />
      </svg>
    </button>
  </div>
</div>