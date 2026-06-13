<script lang="ts">
  /**
   * @component ViewerCore
   * @description スライドのHTMLレンダリング、Iframe管理、および表示モード（スクロール／単一スライド）に応じたレイアウト制御と操作可否を一元管理する統合コアコンポーネント。
   */
  import { onMount, onDestroy } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import { getViewerState } from "../../states/ViewerState.svelte";
  import SlideIframe from "../Common/SlideIframe.svelte";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  let {
    renderMode = "SCROLL",
    interactive = true,
    currentPage = 1,
  } = $props<{
    renderMode?: "SCROLL" | "SLIDE";
    interactive?: boolean;
    currentPage?: number;
  }>();

  const appState = getAppState();
  const viewerState = getViewerState();

  let iframeDocRef = $state<Document | null>(null);
  let iframeWinRef = $state<Window | null>(null);
  let wrapperEl = $state<HTMLElement | null>(null);
  let viewerContainerEl = $state<HTMLElement | null>(null);
  let isIframeLoaded = $state(false);
  let localScale = $state(1.0);

  /**
   * 現在の表示モード、ウィンドウ寸法、ズーム設定に基づいてスライドの拡大縮小率およびコンテナの寸法を適用します。
   */
  function applyLayout(): void {
    if (!iframeDocRef || !wrapperEl || !viewerContainerEl || !isIframeLoaded) return;

    const slidesEl = iframeDocRef.querySelector(".slides") as HTMLElement | null;
    if (!slidesEl) return;

    const vW = viewerContainerEl.clientWidth;
    const vH = viewerContainerEl.clientHeight;

    if (renderMode === "SCROLL") {
      viewerState.updateLayout(vW, vH, BASE_WIDTH, BASE_HEIGHT);
      localScale = viewerState.currentZoom;

      slidesEl.style.transformOrigin = "top left";
      slidesEl.style.transform = `scale(${localScale})`;
      slidesEl.style.width = `${BASE_WIDTH}px`;

      const unscaledHeight = slidesEl.scrollHeight;
      wrapperEl.style.width = `${BASE_WIDTH * localScale}px`;
      wrapperEl.style.height = `${unscaledHeight * localScale}px`;
      wrapperEl.style.margin = "0 auto";
    } else {
      localScale = Math.min(vW / BASE_WIDTH, vH / BASE_HEIGHT);

      slidesEl.style.transformOrigin = "top left";
      slidesEl.style.transform = `scale(${localScale})`;
      slidesEl.style.width = `${BASE_WIDTH}px`;

      wrapperEl.style.width = `${BASE_WIDTH * localScale}px`;
      wrapperEl.style.height = `${BASE_HEIGHT * localScale}px`;
      wrapperEl.style.margin = "auto";
    }
  }

  /**
   * ウィンドウのリサイズイベントをトリガーにレイアウトの再計算とスクロール位置の補正を行います。
   */
  function handleResize(): void {
    applyLayout();
    if (renderMode === "SLIDE") {
      scrollToPage(currentPage, false);
    } else {
      scrollToPage(viewerState.currentPage, false);
    }
  }

  /**
   * 指定されたページ番号のスライド位置へコンテナをスクロールさせます。
   * @param pageNumber - 移動対象 of ページ番号
   * @param smooth - スムーズスクロールを有効にするか否か
   */
  function scrollToPage(pageNumber: number, smooth = true): void {
    if (!iframeDocRef || !viewerContainerEl || !isIframeLoaded) return;

    const target = iframeDocRef.getElementById("slide-" + pageNumber);
    if (target) {
      const targetTop = target.offsetTop * localScale;
      viewerContainerEl.scrollTo({
        top: targetTop,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  /**
   * Iframeの内部ドキュメントが完全にロードされた際の初期化処理を行います。
   * @param iframeDoc - ロードされたIframeのDocumentインスタンス
   * @param iframeWin - ロードされたIframeのWindowインスタンス
   */
  function handleIframeLoad(iframeDoc: Document, iframeWin: Window) {
    iframeDocRef = iframeDoc;
    iframeWinRef = iframeWin;
    viewerState.totalPages = iframeDoc.querySelectorAll(".page").length;
    isIframeLoaded = true;

    applyLayout();
    
    if (renderMode === "SLIDE") {
      scrollToPage(currentPage, false);
    } else {
      scrollToPage(viewerState.currentPage, false);
    }

    if (interactive) {
      iframeWin.addEventListener("keydown", handleKeyDown);
    }
  }

  /**
   * 操作可能状態におけるキーボードイベント（ショートカットやページ送り）を処理します。
   * @param e - キーボードイベントオブジェクト
   */
  function handleKeyDown(e: KeyboardEvent) {
    if (!interactive) return;

    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      appState.requestPrint();
      return;
    }

    if (renderMode === "SLIDE" || viewerState.currentMode !== "SCROLL") {
      switch (e.key) {
        case "ArrowRight":
        case " ":
        case "PageDown":
        case "Enter":
          e.preventDefault();
          viewerState.changePageRelative(1);
          break;
        case "ArrowLeft":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          viewerState.changePageRelative(-1);
          break;
      }
    }
  }

  /**
   * スクロールビューモードにおいて、現在のスクロール位置からアクティブなページ番号を逆算して状態を更新します。
   */
  function handleScroll() {
    if (!interactive || renderMode !== "SCROLL" || !iframeDocRef || !viewerContainerEl || !isIframeLoaded) return;

    const pages = iframeDocRef.querySelectorAll(".page");
    let detectedPage = 1;

    pages.forEach((page, i) => {
      if (viewerContainerEl!.scrollTop >= (page as HTMLElement).offsetTop * localScale - 100) {
        detectedPage = i + 1;
      }
    });

    viewerState.updatePageFromScroll(detectedPage);
    viewerState.updateScrollTop(viewerContainerEl.scrollTop);
  }

  $effect(() => {
    if (isIframeLoaded) {
      applyLayout();
    }
  });

  $effect(() => {
    const signal = viewerState.navigationSignal;
    if (renderMode === "SCROLL" && signal.source === "program") {
      scrollToPage(signal.page, true);
    }
  });

  $effect(() => {
    if (renderMode === "SLIDE" && isIframeLoaded) {
      scrollToPage(currentPage, false);
    }
  });

  $effect(() => {
    if (!interactive && renderMode === "SCROLL" && viewerContainerEl) {
      const targetContext = viewerState.modeContexts[viewerState.currentMode];
      if (targetContext) {
        viewerContainerEl.scrollTop = targetContext.scrollTop;
      }
    }
  });

  onMount(() => {
    window.addEventListener("resize", handleResize);
    if (interactive) {
      window.addEventListener("keydown", handleKeyDown);
    }
  });

  onDestroy(() => {
    window.removeEventListener("resize", handleResize);
    if (interactive) {
      window.removeEventListener("keydown", handleKeyDown);
    }
    if (iframeWinRef) {
      iframeWinRef.removeEventListener("keydown", handleKeyDown);
    }
  });
</script>

<div
  id="viewer-container"
  class={renderMode === "SLIDE" ? "mode-slide" : "mode-scroll"}
  class:readonly={!interactive}
  bind:this={viewerContainerEl}
  onscroll={handleScroll}
>
  <div id="slides-scale-wrapper" bind:this={wrapperEl}>
    <SlideIframe isPresentMode={renderMode === "SLIDE"} slidesHtml={appState.slidesHtml} onIframeLoad={handleIframeLoad} />
  </div>
</div>

<style>
  #viewer-container {
    width: 100%;
    height: 100%;
    overflow-x: hidden;
  }

  .mode-scroll {
    overflow-y: auto;
  }

  .mode-slide {
    overflow-y: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    background: #000;
  }

  .readonly {
    pointer-events: none;
    user-select: none;
  }
</style>