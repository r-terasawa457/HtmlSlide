<script lang="ts">
  /**
   * @component ViewerCore
   * @description スライドのHTMLレンダリング、Iframe管理、および表示モード（スクロール／単一スライド）に応じたレイアウト制御と操作可否を一元管理する統合コアコンポーネント。
   */
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

  /**
   * 現在の表示モード、ウィンドウ寸法、ズーム設定に基づいてスライドの拡大縮小率およびコンテナの寸法を適用します。
   * SLIDEモード時はスクロールに頼らず、トランスフォームによるシフト変形で正確にページを切り替えます。
   */
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
    } else {
      // 💡 SLIDEモード：画面にジャストフィットする倍率を計算
      localScale = Math.min(vW / BASE_WIDTH, vH / BASE_HEIGHT);
      
      // 現在表示すべきスライド要素の元の offsetTop を取得
      const target = iframeDocRef.getElementById("slide-" + currentPage);
      const targetTop = target ? target.offsetTop : 0;

      slidesEl.style.transformOrigin = "top left";
      // 💡 該当ページの高さ分だけ上に引き上げ（translateY）、その後に全体のscaleを適用
      slidesEl.style.transform = `scale(${localScale}) translateY(${-targetTop}px)`;
      slidesEl.style.width = `${BASE_WIDTH}px`;

      // ラッパーの表示領域を「ジャスト1ページ分」に完全にクリップして固定
      wrapperEl.style.width = `${BASE_WIDTH * localScale}px`;
      wrapperEl.style.height = `${BASE_HEIGHT * localScale}px`;
      wrapperEl.style.margin = "auto";
      wrapperEl.style.overflow = "hidden";
    }
  }

  /**
   * 指定されたページ番号のスライド位置へコンテナを移動させます。
   */
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
          scrollTimeoutId = window.setTimeout(() => {
            isProgramScrolling = false;
          }, 300);
        }
      }
    } else {
      // 💡 SLIDEモード時はトランスフォームの再計算を実行するだけで画面がカチッと切り替わる
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

  // 💡 状態（モード・ズーム・現在ページ）の変更をSvelte 5が自動追跡し、レイアウトとシフト位置をリアルタイムに再計算
  $effect(() => {
    if (isIframeLoaded) {
      const _mode = renderMode;
      const _zoom = currentZoom;
      const _page = currentPage;
      tick().then(() => {
        handleResize(); // 最初に要素寸法を再取得させる
        applyLayout();
    });
    }
  });

  $effect(() => {
    const win = iframeWinRef;
    if (win && interactive) {
      win.addEventListener("keydown", handleKeyDown);
      return () => {
        win.removeEventListener("keydown", handleKeyDown);
      };
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
  #viewer-container { width: 100%; height: 100%; overflow-x: hidden; }
  .mode-scroll { overflow-y: auto; background-color: transparent;}
  .mode-slide { overflow-y: hidden; display: flex; justify-content: center; align-items: center; background: #000; }
  .readonly { pointer-events: none; user-select: none; }
</style>