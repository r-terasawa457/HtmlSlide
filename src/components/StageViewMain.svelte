<script lang="ts">
  /**
   * @component StageViewMain
   * @description 外部ディスプレイまたは別ウィンドウ（ステージビュー）のルートコンポーネント。
   * 独立したAppStateを初期化し、親ウィンドウから受信したスライドデータをマッピングして同期します。
   */
  import { onMount, onDestroy } from "svelte";
  import { initAppState } from "../states/AppState.svelte";
  import ViewerCore from "./Viewer/ViewerCore.svelte";

  const appState = initAppState();

  let renderMode = $state<"SCROLL" | "SLIDE">("SLIDE");
  let currentPage = $state(1);
  let currentZoom = $state(1.0);
  let scrollTop = $state(0);
  let totalPages = $state(1);

  /**
   * 親ウィンドウからの同期メッセージを受信し、ローカル状態およびAppStateの状態を更新します。
   */
  function handleMessage(e: MessageEvent): void {
    console.log("Received message in StageViewMain:", e.data);
    if (!e.data || e.data.type !== "sync_stage") return;

    renderMode = e.data.renderMode;
    currentPage = e.data.currentPage;
    currentZoom = e.data.currentZoom;
    scrollTop = e.data.scrollTop;

    if (e.data.slidesHtml !== undefined) {
      appState.slidesHtml = e.data.slidesHtml;
    }
    if (e.data.title !== undefined) {
      appState.title = e.data.title;
    }
  }

  onMount(() => {
    window.addEventListener("message", handleMessage);
    
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "stage_ready" }, "*");
    }
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
  });
</script>

<div id="stage-view-root">
  <ViewerCore 
    {renderMode} 
    interactive={false} 
    bind:currentPage 
    bind:currentZoom 
    bind:totalPages
    bind:scrollTop 
  />
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