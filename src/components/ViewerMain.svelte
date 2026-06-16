<script lang="ts">
  /**
   * @component ViewerMain
   * @description 親ウィンドウのメイン画面表示を統括し、表示モードの切り替え制御、UIレイアウトの動的コンポーズ、および外部ステージウィンドウへの一方向同期メッセージングを担うマスターコンポーネント。
   */
  import { onMount, onDestroy } from "svelte";
  import { getAppState } from "../states/AppState.svelte";
  import { getViewerState } from "../states/ViewerState.svelte";
  import ControlBar from "./Viewer/ControlBar.svelte";
  import ViewerCore from "./Viewer/ViewerCore.svelte";
  import PresenterConsole from "./Panes/PresenterConsole.svelte";

  const appState = getAppState();
  const viewerState = getViewerState();
  
  let isStageReady = $state(false);

  function handleMessage(e: MessageEvent): void {
    console.log("Received message in ViewerMain:", e.data);
    if (e.data && e.data.type === "stage_ready") {
      isStageReady = true;
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
        slidesHtml: appState.slidesHtml,
        title: appState.title
      };
      stage.postMessage(syncPayload, "*");
    }
  });

  onMount(() => {
    window.addEventListener("message", handleMessage);
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
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
          <ViewerCore 
            renderMode="SCROLL" 
            interactive={true} 
            bind:currentPage={viewerState.currentPage} 
            bind:currentZoom={viewerState.currentZoom}
            bind:totalPages={viewerState.totalPages}
            bind:scrollTop={viewerState.modeContexts.SCROLL.scrollTop}
            bind:navigationSignal={viewerState.navigationSignal}
          />
        {:else if viewerState.currentMode === "STANDALONE_PRES"}
          <ViewerCore 
            renderMode="SLIDE" 
            interactive={true} 
            bind:currentPage={viewerState.currentPage} 
            bind:currentZoom={viewerState.currentZoom}
            bind:scrollTop={viewerState.modeContexts.SCROLL.scrollTop}
            bind:totalPages={viewerState.totalPages}
            bind:navigationSignal={viewerState.navigationSignal} />
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