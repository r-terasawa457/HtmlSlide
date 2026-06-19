<script lang="ts">
  /**
   * @component StageViewMain
   * @description 外部ディスプレイまたは別ウィンドウ（ステージビュー）のルートコンポーネント。
   * 独立したAppStateを初期化し、親ウィンドウから受信したスライドデータをマッピングして同期します。
   */
  import { onMount, onDestroy } from "svelte";
  import { initAppState } from "../../states/AppState.svelte";
  import SlideCanvas from "../Slide/SlideCanvas.svelte";
  import type { ParsedSlideData } from "../Slide/types";

  const appState = initAppState();

  console.log("loaded")

  let renderMode = $state<"SCROLL" | "SLIDE">("SLIDE");
  let currentPageIndex = $state(0);
  let currentZoom = $state(1.0);
  let scrollTop = $state(0);
  let slideData = $state<ParsedSlideData>({
    containerAttrs: {},
    commons: [],
    pages: []
  });

  /**
   * 親ウィンドウからの同期メッセージを受信し、ローカル状態およびAppStateの状態を更新します。
   */
  function handleMessage(e: MessageEvent): void {
    console.log("Received message in StageViewMain:", e.data);
    if (!e.data || e.data.type !== "sync_stage") return;

    renderMode = e.data.renderMode;
    currentPageIndex = e.data.currentPage - 1;
    scrollTop = e.data.scrollTop;

    if (e.data.data !== undefined) {
      slideData = e.data.data;
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
  <SlideCanvas
    data={slideData}
    mode={renderMode === "SCROLL" ? "scroll" : "slide"}
    fit_mode="contain"
    width="100%"
    height="100%"
    bind:currentPageIndex
    bind:scale={currentZoom}
    bind:scrollTop
  />
</div>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  #stage-view-root {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    background: #000;
    overflow: hidden;
  }
</style>
