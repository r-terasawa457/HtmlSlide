<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import { getViewerState } from "../../states/ViewerState.svelte";
  import SlideIframe from "../Common/SlideIframe.svelte";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  const appState = getAppState();
  const viewerState = getViewerState();

  let iframeDocRef = $state<Document | null>(null);
  let wrapperEl = $state<HTMLElement | null>(null);
  let viewerContainerEl = $state<HTMLElement | null>(null);
  let isIframeLoaded = $state(false);

  function applyZoom(): void {
    if (!iframeDocRef || !wrapperEl || !isIframeLoaded) return;
    const slidesEl = iframeDocRef.querySelector(".slides") as HTMLElement | null;
    if (!slidesEl) return;

    const currentZoom = viewerState.currentZoom;
    slidesEl.style.transformOrigin = "top left";
    slidesEl.style.transform = `scale(${currentZoom})`;
    slidesEl.style.width = `${BASE_WIDTH}px`;

    const unscaledHeight = slidesEl.scrollHeight;
    wrapperEl.style.width = `${BASE_WIDTH * currentZoom}px`;
    wrapperEl.style.height = `${unscaledHeight * currentZoom}px`;
    wrapperEl.style.margin = "0 auto";
  }

  function updateLayout(): void {
    if (!viewerContainerEl) return;
    const vW = viewerContainerEl.clientWidth;
    const vH = viewerContainerEl.clientHeight;
    viewerState.updateLayout(vW, vH, BASE_WIDTH, BASE_HEIGHT);
    applyZoom();
  }

  function scrollToPage(pageNumber: number, smooth = true): void {
    if (!iframeDocRef || !viewerContainerEl || !isIframeLoaded) return;
    const target = iframeDocRef.getElementById("slide-" + pageNumber);
    if (target) {
      viewerContainerEl.scrollTo({
        top: target.offsetTop * viewerState.currentZoom,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  function handleIframeLoad(iframeDoc: Document, iframeWin: Window) {
    iframeDocRef = iframeDoc;
    viewerState.totalPages = iframeDoc.querySelectorAll(".page").length;
    isIframeLoaded = true;

    updateLayout();
    scrollToPage(viewerState.currentPage, false);

    iframeWin.addEventListener("keydown", handleKeyDown);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      appState.requestPrint();
    }
  }

  function handleScroll() {
    if (!iframeDocRef || !viewerContainerEl || !isIframeLoaded) return;

    const pages = iframeDocRef.querySelectorAll(".page");
    let detectedPage = 1;
    const currentZoom = viewerState.currentZoom;

    pages.forEach((page, i) => {
      if (viewerContainerEl!.scrollTop >= (page as HTMLElement).offsetTop * currentZoom - 100) {
        detectedPage = i + 1;
      }
    });

    viewerState.updatePageFromScroll(detectedPage);
  }

  function handleMessage(e: MessageEvent) {
    if (!e.data) return;
    if (e.data.type === "presenter_ready") {
      if (appState.presenterWindow) {
        appState.presenterWindow.postMessage(
          {
            type: "presenter_init",
            slidesHtml: appState.slidesHtml,
            page: viewerState.currentPage,
          },
          "*",
        );
      }
    } else if (e.data.type === "sync_page") {
      viewerState.goToPage(e.data.page);
    }
  }

  $effect(() => {
    const _mode = viewerState.currentMode;
    const _zoom = viewerState.currentZoom;
    applyZoom();
  });

  $effect(() => {
    const signal = viewerState.navigationSignal;
    if (signal.source === "program") {
      scrollToPage(signal.page, true);
    }
  });

  onMount(() => {
    window.addEventListener("resize", updateLayout);
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener("resize", updateLayout);
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div id="viewer-container" bind:this={viewerContainerEl} onscroll={handleScroll}>
  <div id="slides-scale-wrapper" bind:this={wrapperEl}>
    <SlideIframe isPresentMode={false} slidesHtml={appState.slidesHtml} onIframeLoad={handleIframeLoad} />
  </div>
</div>