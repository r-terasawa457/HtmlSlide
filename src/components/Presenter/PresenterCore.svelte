<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import "../../css/presenter.css";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let containerEl = $state<HTMLElement | null>(null);

  let currentPage = $state(1);
  let totalPages = $state(0);
  let slidesHtml = $state("");
  let slidesCss = $state("");
  let srcdoc = $state("");
  let isIframeLoaded = $state(false);

  function createSrcDoc(html: string, css: string): string {
    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    ${css}
  </style>
</head>
<body>
  ${html}
</body>
</html>`;
  }

  // slidesHtmlやslidesCssが変更された時にsrcdocを生成
  $effect(() => {
    if (slidesHtml) {
      srcdoc = createSrcDoc(slidesHtml, slidesCss);
      isIframeLoaded = false;
    }
  });

  function updateLayout(): void {
    if (!containerEl) return;
    const scale = Math.min(
      window.innerWidth / BASE_WIDTH,
      window.innerHeight / BASE_HEIGHT,
    );
    containerEl.style.transform = `scale(${scale})`;
  }

  function navigateToPage(pageNumber: number, smooth = true): void {
    if (!iframeEl || !isIframeLoaded) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc) return;

    const target = iframeDoc.getElementById("slide-" + pageNumber);
    if (target && iframeEl.contentWindow) {
      iframeEl.contentWindow.scrollTo({
        top: target.offsetTop,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  function changePageRelative(offset: number): void {
    const targetPage = currentPage + offset;
    if (targetPage < 1 || targetPage > totalPages) return;

    currentPage = targetPage;
    navigateToPage(currentPage, true);

    if (window.opener) {
      window.opener.postMessage(
        { type: "sync_page", page: currentPage },
        "*",
      );
    }
  }

  function handleIframeLoad() {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc) return;

    totalPages = iframeDoc.querySelectorAll(".page").length;
    isIframeLoaded = true;

    // 初期ナビゲーション
    navigateToPage(currentPage, false);
    updateLayout();

    // iframe内のキーイベント監視
    if (iframeEl.contentWindow) {
      iframeEl.contentWindow.addEventListener("keydown", handlePresenterKeyDown);
    }
  }

  function handlePresenterKeyDown(e: KeyboardEvent) {
    switch (e.key) {
      case "ArrowRight":
      case "Space":
      case "PageDown":
      case "Enter":
        e.preventDefault();
        changePageRelative(1);
        break;
      case "ArrowLeft":
      case "Backspace":
      case "PageUp":
        e.preventDefault();
        changePageRelative(-1);
        break;
    }
  }

  function handleMessage(e: MessageEvent) {
    if (!e.data) return;

    if (e.data.type === "presenter_init") {
      slidesHtml = e.data.slidesHtml;
      slidesCss = e.data.slidesCss;
      currentPage = e.data.page || 1;
    } else if (e.data.type === "sync_page") {
      const pageNumber = e.data.page;
      if (currentPage === pageNumber) return;
      currentPage = pageNumber;
      navigateToPage(currentPage, true);
    }
  }

  function handleFullscreen() {
    document.documentElement.requestFullscreen().catch(console.error);
  }

  // ページの変更検知
  $effect(() => {
    navigateToPage(currentPage, true);
  });

  onMount(() => {
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handlePresenterKeyDown);
    window.addEventListener("resize", updateLayout);

    // 準備完了を親に通知
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
    <iframe
      bind:this={iframeEl}
      onload={handleIframeLoad}
      srcdoc={srcdoc}
      style="width: 100%; height: 100%; border: none; overflow: hidden"
      scrolling="no"
      title="presenter-view"
    ></iframe>
  </div>
  <button id="fullscreen-hint" onclick={handleFullscreen} aria-label="全画面表示">
    全画面表示 (F11)
  </button>
</div>

<style>
  /* プレゼンター固有の配置スタイルを補完 */
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
