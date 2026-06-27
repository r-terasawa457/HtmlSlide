<script lang="ts">
  import type { CanvasWrapperProps } from "./CanvasWrapperProps";
  import LaserPointerOverlay from "./LaserPointerOverlay.svelte";

  let {
    data, mode, currentPageIndex, fitMode, scrollbarMode, backdropColor, boxShadow, slideGap,
    scale, offsetX, offsetY, scrollFillerWidth, scrollFillerHeight, iframeWidth, iframeHeight,
    laserIsActive, laserPhysicalX, laserPhysicalY,
    scrollTop = $bindable(), scrollLeft = $bindable(),
    onscroll, onmousemove, onmouseleave, onkeydown, onMeasuredSize
  }: CanvasWrapperProps = $props();

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let iframeRef = $state<HTMLIFrameElement | null>(null);
  
  let iframeReady = $state(false);
  
  const lastMeasuredSize = { width: 0, height: 0, totalHeight: 0 };

  let ticking = false;
  function handleScroll() {
    if (!wrapperRef) return;
    const top = wrapperRef.scrollTop;
    const left = wrapperRef.scrollLeft;

    if (!ticking) {
      window.requestAnimationFrame(() => {
        if (iframeRef?.contentWindow && scale > 0) {
          iframeRef.contentWindow.scrollTo({ top: top / scale, left: left / scale });
        }
        scrollTop = top;
        scrollLeft = left;
        onscroll(top, left);
        ticking = false;
      });
      ticking = true;
    }
  }

  function handleIframeLoad() {
    iframeReady = true;
  }

  /**
   * 1. iframe 内への生イベントアタッチ
   * 依存: iframeReady (srcdoc ロード完了時に1回だけ確実に実行)
   */
  $effect(() => {
    if (!iframeReady || !iframeRef) return;
    const win = iframeRef.contentWindow;
    const doc = iframeRef.contentDocument;
    if (!win || !doc) return;

    win.addEventListener("mousemove", onmousemove, { passive: true });
    doc.addEventListener("mouseleave", onmouseleave);
    if (onkeydown) win.addEventListener("keydown", onkeydown);

    return () => {
      win.removeEventListener("mousemove", onmousemove);
      doc.removeEventListener("mouseleave", onmouseleave);
      if (onkeydown) win.removeEventListener("keydown", onkeydown);
    };
  });

  /**
   * 2. スライドデータの DOM 注入およびサイズ計測
   * 依存: iframeReady, data (スライドデータが根本から変わった時のみ DOM を再構築)
   */
  $effect(() => {
    if (!iframeReady || !iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc || !doc.body) return;

    // データ変更による再実行時、古い .slides コンテナがあれば削除して重複を防ぐ
    const oldSlides = doc.querySelector(".slides");
    if (oldSlides) {
      oldSlides.remove();
    }

    const slidesDiv = doc.createElement("div");
    slidesDiv.className = "slides";

    // ② containerAttrs を安全に付与
    for (const [key, value] of Object.entries(data.containerAttrs)) {
      slidesDiv.setAttribute(key, value);
    }

    // ③ commons と pages をフラットに並べた HTML 文字列を生成し、一括注入
    const htmlContent = `
      ${data.commons.join("\n")}
      ${data.pages.join("\n")}
    `;
    slidesDiv.insertAdjacentHTML("beforeend", htmlContent);

    // ④ 空だった body の直下に完成した .slides を配置
    doc.body.appendChild(slidesDiv);

    // ⑤ 注入直後の寸法を計測して親へ報告
    const firstPage = doc.querySelector("section.page") as HTMLElement | null;
    const pageContainer = firstPage?.parentElement; // 狙い通り div.slides を指す
    const width = firstPage?.offsetWidth || 0;
    const height = firstPage?.offsetHeight || 0;
    const totalHeight = pageContainer?.offsetHeight || 0;

    if (firstPage && (lastMeasuredSize.width !== width || lastMeasuredSize.height !== height || lastMeasuredSize.totalHeight !== totalHeight)) {
      lastMeasuredSize.width = width;
      lastMeasuredSize.height = height;
      lastMeasuredSize.totalHeight = totalHeight;
      onMeasuredSize(width, height, totalHeight);
    }
  });

  /**
   * 3. 表示モードおよびアクティブページの変更追従
   * 依存: iframeReady, mode, currentPageIndex, data (DOM 再注入完了の同期用)
   */
  $effect(() => {
    if (!iframeReady || !iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc) return;

    // data の変更（＝上記のエフェクトによる DOM 再注入）を検知し、
    // DOM が新しくなった後にもこの制御ロジックを確実に再実行させるためのトリガー
    data;

    const pages = doc.querySelectorAll("section.page");
    
    pages.forEach((page, index) => {
      if (mode === "slide") {
        if (index === currentPageIndex) {
          page.classList.remove("is-hidden");
        } else {
          page.classList.add("is-hidden");
        }
      } else {
        // scroll モード時はすべての非表示クラスを解除
        page.classList.remove("is-hidden");
      }
    });
  });
</script>

<div
  bind:this={wrapperRef}
  class="canvas-wrapper"
  class:hide-scrollbar={mode === 'scroll' && scrollbarMode === 'hidden'}
  style:overflow-y={mode === 'slide' ? (fitMode === 'none' ? 'auto' : 'hidden') : (scrollbarMode === 'always' ? 'scroll' : 'auto')}
  style:overflow-x={fitMode === 'none' ? 'auto' : 'hidden'}
  onscroll={handleScroll}
>
  <div class="scroll-filler" style:width="{scrollFillerWidth}px" style:height="{scrollFillerHeight}px"></div>

  <div class="sticky-viewport-container">
    <iframe
      bind:this={iframeRef}
      srcdoc="<!DOCTYPE html><html><head><style>body { margin: 0; padding: 0; overflow: hidden; } section.page.is-hidden { display: none !important; }</style></head><body></body></html>"
      onload={handleIframeLoad}
      class="slide-canvas"
      style="
        width: {iframeWidth}px;
        height: {iframeHeight}px;
        transform: translate({offsetX}px, {offsetY}px) scale({scale});
        transform-origin: top left;
      "
      title="slide content"
    ></iframe>

    {#if laserIsActive}
      <LaserPointerOverlay x={laserPhysicalX} y={laserPhysicalY} />
    {/if}
  </div>
</div>