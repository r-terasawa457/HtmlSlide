<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { initPresenterState } from "../../states/PresenterState.svelte";
  import SlideIframe from "../Common/SlideIframe.svelte";
  import "../../css/presenter.css";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  const presenterState = initPresenterState();
  let containerEl = $state<HTMLElement | null>(null);
  let isIframeLoaded = $state(false);
  let iframeWinRef: Window | null = null;

  function updateLayout(): void {
    if (!containerEl) return;
    const scale = Math.min(
      window.innerWidth / BASE_WIDTH,
      window.innerHeight / BASE_HEIGHT,
    );
    containerEl.style.transform = `scale(${scale})`;
  }

  function navigateToPage(pageNumber: number, smooth = true): void {
    if (!iframeWinRef || !isIframeLoaded) return;
    const iframeDoc = iframeWinRef.document;

    const target = iframeDoc.getElementById("slide-" + pageNumber);
    if (target) {
      iframeWinRef.scrollTo({
        top: target.offsetTop,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  function handleIframeLoad(iframeDoc: Document, iframeWin: Window) {
    iframeWinRef = iframeWin;
    presenterState.totalPages = iframeDoc.querySelectorAll(".page").length;
    isIframeLoaded = true;

    navigateToPage(presenterState.currentPage, false);
    updateLayout();

    iframeWin.addEventListener("keydown", handlePresenterKeyDown);
  }

  function handlePresenterKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
      case "Space":
      case "PageDown":
      case "Enter":
        e.preventDefault();
        presenterState.changePageRelative(1);
        break;
      case "ArrowLeft":
      case "Backspace":
      case "PageUp":
        e.preventDefault();
        presenterState.changePageRelative(-1);
        break;
    }
  }

  function handleMessage(e: MessageEvent) {
    if (!e.data) return;
    if (e.data.type === "presenter_init") {
      presenterState.slidesHtml = e.data.slidesHtml;
      presenterState.currentPage = e.data.page || 1;
    } else if (e.data.type === "sync_page") {
      presenterState.updatePageFromParent(e.data.page);
    }
  }

  function handleFullscreen() {
    document.documentElement.requestFullscreen().catch(console.error);
  }

  $effect(() => {
    const signal = presenterState.navigationSignal;
    navigateToPage(signal.page, signal.source !== "init");
  });

  onMount(() => {
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handlePresenterKeyDown);
    window.addEventListener("resize", updateLayout);

    if (window.opener) {
      window.opener.postMessage({ type: "presenter_ready" }, "*");
    }
  });

  onDestroy(() => {
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("keydown", handlePresenterKeyDown);
    window.removeEventListener("resize", updateLayout);
  });
</script>

<div class="present-mode">
  <div id="present-container" bind:this={containerEl}>
    <SlideIframe isPresentMode={true} slidesHtml={presenterState.slidesHtml} onIframeLoad={handleIframeLoad} />
  </div>
  <button id="fullscreen-hint" onclick={handleFullscreen} aria-label="全画面表示">
    全画面表示 (F11)
  </button>
</div>

<style>
  .present-mode {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    background: #000;
    overflow: hidden;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>