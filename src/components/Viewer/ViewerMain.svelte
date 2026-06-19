<script lang="ts">
  /**
   * @component ViewerMain
   * @description 親ウィンドウのメイン画面表示を統括し、表示モードの切り替え制御、UIレイアウトの動的コンポーズ、および外部ステージウィンドウへの一方向同期メッセージングを担うマスターコンポーネント。
   */
  import { onMount, onDestroy } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import { getViewerState } from "../../states/ViewerState.svelte";
  import ControlBar from "./ControlBar.svelte";
  import SlideCanvas from "../Slide/SlideCanvas.svelte";
  import PresenterConsole from "./PresenterConsole.svelte";

  const appState = getAppState();
  const viewerState = getViewerState();
  
  let isStageReady = $state(false);

  let fitMode = $derived.by<"contain" | "width" | "none">(() => {
    switch (viewerState.zoomMode) {
      case "FIT_WIDTH":
        return "width";
      case "FIT_HEIGHT":
        return "contain";
      default:
        return "none";
    }
  });

  function handleMessage(e: MessageEvent): void {
    console.log("Received message in ViewerMain:", e.data);
    if (e.data && e.data.type === "stage_ready") {
      isStageReady = true;
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      appState.requestPrint();
      return;
    }

    if (viewerState.currentMode === "STANDALONE_PRES") {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
        case "Enter":
          e.preventDefault();
          viewerState.changePageRelative(1);
          break;
        case "ArrowLeft":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          viewerState.changePageRelative(-1);
          break;
      }
    }
  }

  $effect(() => {
    const stage = viewerState.stageWindow;
    if (!stage || stage.closed) {
      isStageReady = false;
    }
  });

  $effect(() => {
    const stage = viewerState.stageWindow;
    if (stage && !stage.closed && isStageReady) {
      const syncPayload = {
        ...viewerState.stageSyncData,
        title: appState.title
      };
      stage.postMessage(syncPayload, "*");
    }
  });

  onMount(() => {
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div id="viewer-main-root">
  {#if viewerState.currentMode === "CONSOLE_PRES"}
    <PresenterConsole />
  {:else}
    <div id="viewer-ui-wrapper" class={viewerState.currentMode === "STANDALONE_PRES" ? "pres-layout" : "normal-layout"}>
      <ControlBar />
      <div id="core-viewport">
        {#if viewerState.currentMode === "SCROLL"}
          <SlideCanvas
            data={viewerState.slideData}
            mode="scroll"
            fit_mode={fitMode}
            bind:currentPageIndex={viewerState.currentPageIndex}
            bind:scale={viewerState.currentZoom}
            bind:scrollTop={viewerState.modeContexts.SCROLL.scrollTop}
            onkeydown={handleKeyDown}
          />
        {:else if viewerState.currentMode === "STANDALONE_PRES"}
          <SlideCanvas
            data={viewerState.slideData}
            mode="slide"
            fit_mode={fitMode}
            bind:currentPageIndex={viewerState.currentPageIndex}
            bind:scale={viewerState.currentZoom}
            onkeydown={handleKeyDown}
          />
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  #viewer-main-root { width: 100vw; height: 100vh; display: flex; flex-direction: column; overflow: hidden; background-color: #f5f5f5; }
  #viewer-ui-wrapper { display: flex; flex-direction: column; width: 100%; height: 100%; }
  #core-viewport { flex: 1; width: 100%; height: 100%; position: relative; overflow: hidden; }
  .pres-layout #core-viewport { background-color: #000; }
</style>