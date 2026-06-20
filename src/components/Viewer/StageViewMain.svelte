<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { initAppState } from "../../states/AppState.svelte";
  import SlideCanvas from "../Slide/SlideCanvas.svelte";
  import type { ParsedSlideData } from "../Slide/types";

  const appState = initAppState();

  let renderMode = $state<"SCROLL" | "SLIDE">("SLIDE");
  let currentPageIndex = $state(0);
  let currentZoom = $state(1.0);
  let scrollTop = $state(0);
  let slideData = $state<ParsedSlideData>({
    containerAttrs: {},
    commons: [],
    pages: []
  });

  let isApiFullscreen = $state(false);
  let isNativeFullscreen = $state(false);
  let isAnyFullscreen = $derived(isApiFullscreen || isNativeFullscreen);

  let latestContentWidth = $state(0);
  let latestContentHeight = $state(0);
  let isUserResizing = $state(false);
  let isTransitioningFromFullscreen = $state(false);
  
  let savedOuterWidth = 0;
  let savedOuterHeight = 0;
  let isProgrammaticResize = false;
  let resizeTimeoutId: number | undefined;

  function handleMessage(e: MessageEvent): void {
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

  /**
   * フルスクリーン状態を判定・更新します。
   */
  function updateFullscreenState(): void {
    isApiFullscreen = !!document.fullscreenElement;
    isNativeFullscreen = window.matchMedia("(display-mode: fullscreen)").matches && !isApiFullscreen;
  }

  function handleWindowResize(): void {
    if (isProgrammaticResize) return;

    isUserResizing = true;
    if (resizeTimeoutId) {
      clearTimeout(resizeTimeoutId);
    }

    resizeTimeoutId = window.setTimeout(() => {
      isUserResizing = false;
      
      const wasFullscreen = isAnyFullscreen;
      updateFullscreenState();
      const nowFullscreen = isAnyFullscreen;

      if (wasFullscreen && !nowFullscreen) {
        isTransitioningFromFullscreen = true;
        
        if (savedOuterWidth > 0 && savedOuterHeight > 0) {
          resizeAndCenter(savedOuterWidth, savedOuterHeight);
        }

        window.setTimeout(() => {
          isTransitioningFromFullscreen = false;
        }, 400);
        return;
      }

      if (!nowFullscreen) {
        savedOuterWidth = window.outerWidth;
        savedOuterHeight = window.outerHeight;
      }
    }, 200);
  }

  function resizeAndCenter(targetWidth: number, targetHeight: number): void {
    const currentCenterX = window.screenX + window.outerWidth / 2;
    const currentCenterY = window.screenY + window.outerHeight / 2;

    isProgrammaticResize = true;
    window.resizeTo(targetWidth, targetHeight);
    window.moveTo(currentCenterX - targetWidth / 2, currentCenterY - targetHeight / 2);

    window.setTimeout(() => {
      isProgrammaticResize = false;
    }, 300);
  }

  function toggleFullscreen(): void {
    if (!isApiFullscreen) {
      savedOuterWidth = window.outerWidth;
      savedOuterHeight = window.outerHeight;
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  }

  function handleSlideResize(width: number, height: number): void {
    latestContentWidth = width;
    latestContentHeight = height;
  }

  $effect(() => {
    const w = latestContentWidth;
    const h = latestContentHeight;
    const resizing = isUserResizing;
    const fullscreen = isAnyFullscreen;
    const transitioning = isTransitioningFromFullscreen;

    if (fullscreen || resizing || transitioning || w === 0 || h === 0) return;

    const chromeWidth = window.outerWidth - window.innerWidth;
    const chromeHeight = window.outerHeight - window.innerHeight;

    const targetOuterWidth = w + chromeWidth;
    const targetOuterHeight = h + chromeHeight;

    if (Math.abs(window.outerWidth - targetOuterWidth) > 2 || Math.abs(window.outerHeight - targetOuterHeight) > 2) {
      resizeAndCenter(targetOuterWidth, targetOuterHeight);
      savedOuterWidth = targetOuterWidth;
      savedOuterHeight = targetOuterHeight;
    }
  });

  onMount(() => {
    window.addEventListener("message", handleMessage);
    window.addEventListener("resize", handleWindowResize);
    document.addEventListener("fullscreenchange", updateFullscreenState);
    
    updateFullscreenState();
    if (!isAnyFullscreen) {
      savedOuterWidth = window.outerWidth;
      savedOuterHeight = window.outerHeight;
    }

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: "stage_ready" }, "*");
    }
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("resize", handleWindowResize);
    document.removeEventListener("fullscreenchange", updateFullscreenState);
    if (resizeTimeoutId) {
      clearTimeout(resizeTimeoutId);
    }
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
    onresize={handleSlideResize}
  />

  {#if !isNativeFullscreen}
    <div class="fullscreen-trigger">
      <button class="fullscreen-button" onclick={toggleFullscreen}>
        {isApiFullscreen ? "ウィンドウ表示" : "全画面表示"}
      </button>
    </div>
  {/if}
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
    position: relative;
  }

  .fullscreen-trigger {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 160px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .fullscreen-button {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    font-size: 18px;
    background: rgba(30, 30, 30, 0.8);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }

  .fullscreen-trigger:hover .fullscreen-button {
    opacity: 1;
    transform: translateY(0);
  }
</style>