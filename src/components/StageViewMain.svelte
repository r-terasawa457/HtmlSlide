<script lang="ts">
  /**
   * @component StageViewMain
   * @description 外部ディスプレイまたは別ウィンドウ（ステージビュー）のルートコンポーネント。
   * 親ウィンドウからの `postMessage` による一方向同期メッセージを監視し、表示専用のレシーバーとしてレイアウトおよび表示ページを動的に切り替えます。
   */
  import { onMount, onDestroy } from "svelte";
  import { getViewerState } from "../states/ViewerState.svelte";
  import ViewerCore from "./Viewer/ViewerCore.svelte";

  const viewerState = getViewerState();

  let renderMode = $state<"SCROLL" | "SLIDE">("SLIDE");
  let currentPage = $state(1);

  /**
   * 親ウィンドウ（マスター）から送信される同期メッセージを受信し、ステージ側の表示状態および状態管理クラスを更新します。
   * @param e - メッセージイベントオブジェクト
   */
  function handleMessage(e: MessageEvent): void {
    if (!e.data || e.data.type !== "sync_stage") return;

    renderMode = e.data.renderMode;
    currentPage = e.data.currentPage;

    if (renderMode === "SCROLL") {
      viewerState.currentMode = "SCROLL";
      viewerState.modeContexts.SCROLL.scrollTop = e.data.scrollTop;
      viewerState.currentZoom = e.data.currentZoom;
    } else {
      viewerState.currentMode = "STANDALONE_PRES";
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
  });
</script>

<div id="stage-view-root">
  <ViewerCore {renderMode} interactive={false} {currentPage} />
</div>

<style>
  #stage-view-root {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    background: #000;
    overflow: hidden;
  }
</style>