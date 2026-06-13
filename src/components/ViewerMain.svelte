<script lang="ts">
  /**
   * @component ViewerMain
   * @description 親ウィンドウのメイン画面表示を統括し、表示モードの切り替え制御、UIレイアウトの動的コンポーズ、および外部ステージウィンドウへの一方向同期メッセージングを担うマスターコンポーネント。
   */
  import { getViewerState } from "../states/ViewerState.svelte";
  import ControlBar from "./Viewer/ControlBar.svelte";
  import ViewerCore from "./Viewer/ViewerCore.svelte";
  import PresenterConsole from "./Panes/PresenterConsole.svelte";

  const viewerState = getViewerState();

  /**
   * 外部ステージウィンドウ（レシーバー）が有効である場合、状態の変更（ページ、スクロール位置、ズーム率）を一方向でリアルタイムに同期します。
   */
  $effect(() => {
    const stage = viewerState.stageWindow;
    if (stage && !stage.closed) {
      const syncPayload = viewerState.stageSyncData;
      stage.postMessage(syncPayload, "*");
    }
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
          <ViewerCore renderMode="SCROLL" interactive={true} currentPage={viewerState.currentPage} />
        {:else if viewerState.currentMode === "STANDALONE_PRES"}
          <ViewerCore renderMode="SLIDE" interactive={true} currentPage={viewerState.currentPage} />
        {/if}
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
</style>