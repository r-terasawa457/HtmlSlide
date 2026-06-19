<script lang="ts">
  import { onMount, onDestroy, tick } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import SlideIframe from "../Common/SlideIframe.svelte";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  let {
    renderMode = "SCROLL",
    interactive = true,
    currentPage = $bindable(1),
    currentZoom = $bindable(1.0),
    totalPages = $bindable(1),
    scrollTop = $bindable(0),
    navigationSignal = $bindable(null)
  } = $props<{
    renderMode?: "SCROLL" | "SLIDE";
    interactive?: boolean;
    currentPage?: number;
    currentZoom?: number;
    totalPages?: number;
    scrollTop?: number;
    navigationSignal?: { page: number; source: string } | null;
  }>();

  const appState = getAppState();

  let iframeDocRef = $state<Document | null>(null);
  let iframeWinRef = $state<Window | null>(null);
  let wrapperEl = $state<HTMLElement | null>(null);
  let viewerContainerEl = $state<HTMLElement | null>(null);
  let isIframeLoaded = $state(false);
  let localScale = $state(1.0);
  let isProgramScrolling = false;
  let scrollTimeoutId: number;

  function applyLayout(): void {
    if (!iframeDocRef || !wrapperEl || !viewerContainerEl || !isIframeLoaded) return;
    const slidesEl = iframeDocRef.querySelector(".slides") as HTMLElement | null;
    if (!slidesEl) return;

    const vW = viewerContainerEl.clientWidth;
    const vH = viewerContainerEl.clientHeight;

    if (renderMode === "SCROLL") {
      localScale = currentZoom;
      slidesEl.style.transformOrigin = "top left";
      slidesEl.style.transform = `scale(${localScale})`;
      slidesEl.style.width = `${BASE_WIDTH}px`;

      const unscaledHeight = slidesEl.scrollHeight;
      wrapperEl.style.width = `${BASE_WIDTH * localScale}px`;
      wrapperEl.style.height = `${unscaledHeight * localScale}px`;
      wrapperEl.style.margin = "0 auto";
      wrapperEl.style.overflow = "visible";
    } else {
      localScale = Math.min(vW / BASE_WIDTH, vH / BASE_HEIGHT);
      const target = iframeDocRef.getElementById("slide-" + currentPage);
      const targetTop = target ? target.offsetTop : 0;

      slidesEl.style.transformOrigin = "top left";
      slidesEl.style.transform = `scale(${localScale}) translateY(${-targetTop}px)`;
      slidesEl.style.width = `${BASE_WIDTH}px`;

      wrapperEl.style.width = `${BASE_WIDTH * localScale}px`;
      wrapperEl.style.height = `${BASE_HEIGHT * localScale}px`;
      wrapperEl.style.margin = "auto";
      wrapperEl.style.overflow = "hidden";
    }
  }

  function scrollToPage(pageNumber: number, smooth = true): void {
    if (!iframeDocRef || !viewerContainerEl || !isIframeLoaded) return;
    if (renderMode === "SCROLL") {
      const target = iframeDocRef.getElementById("slide-" + pageNumber);
      if (target) {
        if (smooth) {
          isProgramScrolling = true;
          window.clearTimeout(scrollTimeoutId);
        }
        const targetTop = target.offsetTop * localScale;
        viewerContainerEl.scrollTo({
          top: targetTop,
          behavior: smooth ? "smooth" : "auto",
        });
        if (smooth) {
          scrollTimeoutId = window.setTimeout(() => { isProgramScrolling = false; }, 300);
        }
      }
    } else {
      applyLayout();
    }
  }

  function handleScroll() {
    if (!interactive || renderMode !== "SCROLL" || !iframeDocRef || !viewerContainerEl || !isIframeLoaded || isProgramScrolling) return;
    const pages = iframeDocRef.querySelectorAll(".page");
    let detectedPage = 1;

    pages.forEach((page, i) => {
      if (viewerContainerEl!.scrollTop >= (page as HTMLElement).offsetTop * localScale - 100) {
        detectedPage = i + 1;
      }
    });
    currentPage = detectedPage;
    scrollTop = viewerContainerEl.scrollTop;
  }

  function handleIframeLoad(iframeDoc: Document, iframeWin: Window) {
    iframeDocRef = iframeDoc;
    iframeWinRef = iframeWin;
    totalPages = iframeDoc.querySelectorAll(".page").length;
    isIframeLoaded = true;
    applyLayout();
    scrollToPage(currentPage, false);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!interactive) return;
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      appState.requestPrint();
      return;
    }

    if (renderMode === "SLIDE") {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
        case "Enter":
          e.preventDefault();
          if (currentPage < totalPages) currentPage += 1;
          break;
        case "ArrowLeft":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          if (currentPage > 1) currentPage -= 1;
          break;
      }
    }
  }

  function handleResize(): void {
    applyLayout();
    scrollToPage(currentPage, false);
  }

  $effect(() => {
    if (isIframeLoaded) {
      const _mode = renderMode;
      const _zoom = currentZoom;
      const _page = currentPage;
      tick().then(() => {
        handleResize();
        applyLayout();
      });
    }
  });

  $effect(() => {
    const win = iframeWinRef;
    if (win && interactive) {
      win.addEventListener("keydown", handleKeyDown);
      return () => { win.removeEventListener("keydown", handleKeyDown); };
    }
  });

  $effect(() => {
    if (renderMode === "SCROLL" && navigationSignal?.source === "program") {
      scrollToPage(navigationSignal.page, true);
    }
  });

  $effect(() => {
    if (!interactive && renderMode === "SCROLL" && viewerContainerEl) {
      isProgramScrolling = true;
      viewerContainerEl.scrollTop = scrollTop;
      window.clearTimeout(scrollTimeoutId);
      scrollTimeoutId = window.setTimeout(() => { isProgramScrolling = false; }, 50);
    }
  });

  onMount(() => {
    window.addEventListener("resize", handleResize);
    if (interactive) {
      window.addEventListener("keydown", handleKeyDown);
    }
  });

  onDestroy(() => {
    window.clearTimeout(scrollTimeoutId);
    window.removeEventListener("resize", handleResize);
    if (interactive) {
      window.removeEventListener("keydown", handleKeyDown);
    }
  });
</script>

<div
  id="viewer-container"
  class="w-full h-full overflow-x-hidden box-border p-4
         {renderMode === 'SLIDE' ? 'overflow-y-hidden flex justify-center items-center bg-black' : 'overflow-y-auto bg-transparent'}
         {!interactive ? 'pointer-events-none select-none' : ''}"
  bind:this={viewerContainerEl}
  onscroll={handleScroll}
>
  <div id="slides-scale-wrapper" bind:this={wrapperEl} class="block">
    <SlideIframe isPresentMode={renderMode === "SLIDE"} slidesHtml={appState.slidesHtml} onIframeLoad={handleIframeLoad} />
  </div>
</div>