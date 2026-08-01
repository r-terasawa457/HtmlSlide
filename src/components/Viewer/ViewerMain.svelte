<script lang="ts">
  /**
   * @component ViewerMain
   */
  import { onMount, onDestroy } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import { getViewerState } from "../../states/ViewerState.svelte";
  import ControlBar from "./ControlBar.svelte";
  import SlideRenderer from "../slide3/SlideRenderer.svelte";
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
      stage.postMessage(viewerState.stageSyncData, "*");
    }
  });

  function handleFullscreenUpdate(): void {
    viewerState.updateMainFullscreenState();
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleFullscreenUpdate);
    document.addEventListener("fullscreenchange", handleFullscreenUpdate);
    viewerState.updateMainFullscreenState();
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleFullscreenUpdate);
    document.removeEventListener("fullscreenchange", handleFullscreenUpdate);
  });
</script>

{#snippet sharedCanvas()}
  <SlideRenderer
    pages={viewerState.currentMode === "SCROLL" ? "__all__" : "__currentPage__"}
    {fitMode}
    bind:currentPage={viewerState.currentPageIndex}
    bind:scale={viewerState.currentZoom}
    laserPointerActive={viewerState.laserActive}
    laserTrackingActive={viewerState.laserActive}
  />
{/snippet}

<div id="viewer-main-root">
  {#if viewerState.currentMode === "CONSOLE_PRES"}
    <PresenterConsole canvas={sharedCanvas} />
  {:else}
    <div
      id="viewer-ui-wrapper"
      class="{viewerState.currentMode === 'STANDALONE_PRES'
        ? 'pres-layout'
        : 'normal-layout'} {viewerState.isMainFullscreen
        ? 'fullscreen-layout'
        : ''}"
    >
      <ControlBar />
      <div id="core-viewport">
        {@render sharedCanvas()}
      </div>
    </div>
  {/if}
</div>

<style>
  #viewer-main-root {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background-color: #f5f5f5;
  }
  #viewer-ui-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    position: relative;
  }
  #core-viewport {
    flex: 1;
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
  }
  .pres-layout #core-viewport {
    background-color: #000;
  }
  .fullscreen-layout #core-viewport {
    position: absolute;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 1;
  }
</style>
