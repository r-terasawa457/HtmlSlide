<script lang="ts">
  /**
   * @file SlideCanvas.svelte
   * @description ダミースクロール（ハイブリッド同期）方式を採用した高性能スライドレンダラー。
   * レーザーポインター機能は、ネイティブスクロールと完全に同期させるため、scroll-filler（スクロール空間）の直下に配置されます。
   */

  import { onMount } from 'svelte';
  import type { ParsedSlideData } from './types';
  import LaserPointerOverlay from './LaserPointerOverlay.svelte';

  /** @types Props */
  let {
    data,
    mode = 'slide',
    fit_mode = 'contain',
    currentPageIndex = $bindable(0),
    scale = $bindable(1.0),
    width = '100%',
    height = '100%',
    scrollTop = $bindable(0),
    scrollLeft = $bindable(0),
    syncUnscaledViewport = undefined,
    scrollbarMode = 'auto',
    backdropColor = 'transparent',
    slideGap = 0,
    boxShadow = 'none',
    shadowPaddingX = 20,
    shadowPaddingY = slideGap,
    onresize,
    onscroll,
    onkeydown,
    laserActive = $bindable(false),
    laserX = $bindable(0),
    laserY = $bindable(0),
    isPresenter = false
  } = $props<{
    data: ParsedSlideData;
    mode?: 'scroll' | 'slide';
    fit_mode?: 'contain' | 'width' | 'none';
    currentPageIndex?: number;
    scale?: number;
    width?: string;
    height?: string;
    scrollTop?: number;
    scrollLeft?: number;
    syncUnscaledViewport?: { centerTop: number; centerLeft: number; width: number; height: number };
    scrollbarMode?: 'always' | 'hidden' | 'auto';
    backdropColor?: string;
    slideGap?: number;
    boxShadow?: string;
    shadowPaddingX?: number;
    shadowPaddingY?: number;
    onresize?: (width: number, height: number) => void;
    onscroll?: (top: number, left: number, info?: { unscaledCenterTop: number; unscaledCenterLeft: number; unscaledWidth: number; unscaledHeight: number }) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    laserActive?: boolean;
    laserX?: number;
    laserY?: number;
    isPresenter?: boolean;
  }>();

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let iframeRef = $state<HTMLIFrameElement | null>(null);
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let slideWidth = $state(1920);
  let slideHeight = $state(1080);
  let hasMeasured = $state(false);
  let lastPageIndex = $state<number | undefined>(undefined);
  let prevMode = $state<'slide' | 'scroll' | undefined>(undefined);

  let tickingWrapper = false;
  let tickingIframe = false;

  let lastInternalTop = 0;
  let lastInternalLeft = 0;
  let systemScrollbarWidth = $state(0);

  let pureTotalHeight = $derived(
    mode === 'scroll'
      ? slideHeight * data.pages.length + slideGap * (data.pages.length - 1)
      : slideHeight
  );

  let effectiveDimensions = $derived.by(() => {
    if (!hasMeasured || containerWidth === 0 || containerHeight === 0) {
      return { width: containerWidth, height: containerHeight };
    }

    let effectiveWidth = containerWidth;
    let effectiveHeight = containerHeight;

    if (mode === 'scroll') {
      if (scrollbarMode === 'always') {
        effectiveWidth = Math.max(0, containerWidth - systemScrollbarWidth);
      } else if (scrollbarMode === 'auto') {
        const trialScaleX = containerWidth / slideWidth;
        const trialScale = fit_mode === 'width' ? trialScaleX : Math.min(trialScaleX, containerHeight / slideHeight);
        const trialTotalHeight = pureTotalHeight * trialScale;

        if (trialTotalHeight > containerHeight) {
          effectiveWidth = Math.max(0, containerWidth - systemScrollbarWidth);
        }
      }
    }

    return { width: effectiveWidth, height: effectiveHeight };
  });

  let computedScale = $derived.by(() => {
    // 外部からの等倍ビューポート領域の強制同期がある場合、それをコンテナにアスペクト比維持で収めるスケールを最優先する
    if (mode === 'scroll' && syncUnscaledViewport && syncUnscaledViewport.width > 0 && syncUnscaledViewport.height > 0) {
      if (containerWidth > 0 && containerHeight > 0) {
        const scaleX = containerWidth / syncUnscaledViewport.width;
        const scaleY = containerHeight / syncUnscaledViewport.height;
        return Math.min(scaleX, scaleY); // 完全に内包(contain)させる
      }
    }

    if (fit_mode === 'none') return scale;
    if (!hasMeasured || containerWidth === 0 || containerHeight === 0) return 1.0;
    if (slideWidth === 0 || slideHeight === 0) return 1.0;

    const scaleX = effectiveDimensions.width / slideWidth;
    if (fit_mode === 'width') return scaleX;

    const scaleY = effectiveDimensions.height / slideHeight;
    return Math.min(scaleX, scaleY);
  });

  let currentPaddingX = $derived.by(() => {
    if (mode !== 'scroll' || scale <= 0) return 0;
    const availableSpaceX = (effectiveDimensions.width - slideWidth * scale) / 2;
    if (availableSpaceX <= 0) return 0;
    return Math.min(shadowPaddingX, availableSpaceX / scale);
  });

  let currentPaddingY = $derived(mode === 'scroll' ? shadowPaddingY : 0);

  let totalInternalWidth = $derived(slideWidth + currentPaddingX * 2);
  let totalInternalHeight = $derived(pureTotalHeight + currentPaddingY * 2);

  let offsetX = $derived(
    effectiveDimensions.width > totalInternalWidth * scale
      ? (effectiveDimensions.width - totalInternalWidth * scale) / 2
      : 0
  );
  let offsetY = $derived(
    effectiveDimensions.height > totalInternalHeight * scale
      ? (effectiveDimensions.height - totalInternalHeight * scale) / 2
      : 0
  );

  $effect(() => {
    if (fit_mode !== 'none') {
      scale = computedScale;
    }
  });

  $effect(() => {
    if (onresize) {
      onresize(totalInternalWidth * scale, totalInternalHeight * scale);
    }
  });

  $effect(() => {
    if (mode === 'scroll' && slideHeight > 0) {
      const internalScrollTop = scrollTop / (scale || 1.0);
      const adjustedScrollTop = Math.max(0, internalScrollTop - currentPaddingY);
      const pitch = slideHeight + slideGap;
      const computedIndex = Math.max(
        0,
        Math.min(data.pages.length - 1, Math.round(adjustedScrollTop / pitch))
      );
      if (currentPageIndex !== computedIndex) {
        currentPageIndex = computedIndex;
        lastPageIndex = computedIndex;
      }
    }
  });

  $effect(() => {
    if (mode === 'scroll' && slideHeight > 0) {
      if (lastPageIndex === undefined) {
        lastPageIndex = currentPageIndex;
      }
      if (currentPageIndex !== lastPageIndex || mode !== prevMode) {
        const targetTop = (currentPaddingY + currentPageIndex * (slideHeight + slideGap)) * scale;
        if (Math.abs(scrollTop - targetTop) > 1) {
          scrollTop = targetTop;
        }
        lastPageIndex = currentPageIndex;
        prevMode = mode;
      }
    } else {
      prevMode = mode;
    }
  });

  $effect(() => {
    if (mode === 'slide') {
      lastPageIndex = currentPageIndex;
    }
  });

  function handleWrapperScroll() {
    if (!wrapperRef) return;
    const targetTop = wrapperRef.scrollTop;
    const targetLeft = wrapperRef.scrollLeft;

    const win = iframeRef?.contentWindow;
    if (win && scale > 0 && typeof win.scrollTo === 'function') {
      win.scrollTo({
        top: targetTop / scale,
        left: targetLeft / scale
      });
    }

    if (!tickingWrapper) {
      window.requestAnimationFrame(() => {
        scrollTop = targetTop;
        scrollLeft = targetLeft;
        lastInternalTop = targetTop;
        lastInternalLeft = targetLeft;

        if (onscroll) onscroll(targetTop, targetLeft);
        tickingWrapper = false;
      });
      tickingWrapper = true;
    }
  }

  function handleIframeScroll() {
    const win = iframeRef?.contentWindow;
    const doc = iframeRef?.contentDocument;
    if (!win || !doc) return;

    const currentIframeTop = doc.documentElement.scrollTop || doc.body.scrollTop;
    const currentIframeLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

    const expectedParentTop = currentIframeTop * scale;
    const expectedParentLeft = currentIframeLeft * scale;

    const tolerance = Math.max(1.5, scale);
    if (Math.abs(scrollTop - expectedParentTop) > tolerance || Math.abs(scrollLeft - expectedParentLeft) > tolerance) {
      if (wrapperRef) {
        if (typeof wrapperRef.scrollTo === 'function') {
          wrapperRef.scrollTo({ top: expectedParentTop, left: expectedParentLeft });
        } else {
          wrapperRef.scrollTop = expectedParentTop;
          wrapperRef.scrollLeft = expectedParentLeft;
        }
      }

      if (!tickingIframe) {
        window.requestAnimationFrame(() => {
          scrollTop = expectedParentTop;
          scrollLeft = expectedParentLeft;
          lastInternalTop = expectedParentTop;
          lastInternalLeft = expectedParentLeft;

          if (onscroll) onscroll(expectedParentTop, expectedParentLeft);
          tickingIframe = false;
        });
        tickingIframe = true;
      }
    }
  }

  /**
   * 発表者のマウスイベントを検知し、iframe内のネイティブスクロール量を加算してスライド絶対比率座標に変換します。
   */
  /**
   * 発表者のマウスイベントを検知し、iframe内のネイティブスクロール量を加算してスライド絶対比率座標に変換します。
   * 範囲外にカーソルがある場合は、無効な座標（-1）を設定します。
   */
  function handlePresenterMouseMove(e: MouseEvent): void {
    if (!isPresenter || !laserActive) return;
    const win = iframeRef?.contentWindow;
    const doc = iframeRef?.contentDocument;
    if (!win || !doc) return;

    const currentIframeTop = doc.documentElement.scrollTop || doc.body.scrollTop;
    const currentIframeLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

    const slidePxX = e.clientX + currentIframeLeft;
    const slidePxY = e.clientY + currentIframeTop;

    if (totalInternalWidth > 0 && totalInternalHeight > 0) {
      const targetX = slidePxX / totalInternalWidth;
      const targetY = slidePxY / totalInternalHeight;

      // 1pxでもスライドの外側に出た場合は無効値を設定
      if (targetX < 0 || targetX > 1 || targetY < 0 || targetY > 1) {
        laserX = -1;
        laserY = -1;
      } else {
        laserX = targetX;
        laserY = targetY;
      }
    }
  }

  /**
   * 発表者のマウスがスライド領域外に出た際に、レーザーポインターを非表示にします。
   */
  function handlePresenterMouseLeave(): void {
    if (!isPresenter || !laserActive) return;
    laserX = -1;
    laserY = -1;
  }

  $effect(() => {
    if (!iframeRef) return;
    const win = iframeRef.contentWindow;
    const doc = iframeRef.contentDocument;
    if (!win || !doc) return;

    doc.body.style.margin = '0';
    doc.body.style.padding = '0';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (onkeydown) onkeydown(e);
    };

    win.addEventListener('scroll', handleIframeScroll, { passive: true });
    win.addEventListener('keydown', handleKeyDown);

    return () => {
      win.removeEventListener('scroll', handleIframeScroll);
      win.removeEventListener('keydown', handleKeyDown);
    };
  });

    $effect(() => {
      if (!iframeRef) return;
      const win = iframeRef.contentWindow;
      const doc = iframeRef.contentDocument;
      if (!win || !doc) return;

      if (isPresenter && laserActive) {
        win.addEventListener('mousemove', handlePresenterMouseMove, { passive: true });
        doc.addEventListener('mouseleave', handlePresenterMouseLeave); // 追加
        doc.body.style.cursor = 'none';
      } else {
        doc.body.style.cursor = 'default';
      }

      return () => {
        if (win) win.removeEventListener('mousemove', handlePresenterMouseMove);
        if (doc) {
          doc.removeEventListener('mouseleave', handlePresenterMouseLeave); // 追加
          if (doc.body) doc.body.style.cursor = 'default';
        }
      };
    });

  $effect(() => {
      if (onscroll && isPresenter && hasMeasured && containerWidth > 0 && containerHeight > 0 && scale > 0) {
        const unscaledWidth = containerWidth / scale;
        const unscaledHeight = containerHeight / scale;
        const unscaledCenterTop = (scrollTop / scale) + unscaledHeight / 2;
        const unscaledCenterLeft = (scrollLeft / scale) + unscaledWidth / 2;
        
        onscroll(scrollTop, scrollLeft, {
          unscaledCenterTop,
          unscaledCenterLeft,
          unscaledWidth,
          unscaledHeight
        });
      }
    });

    $effect(() => {
    if (!isPresenter && mode === 'scroll' && syncUnscaledViewport && scale > 0) {
      if (containerWidth > 0 && containerHeight > 0) {
        const targetTop = (syncUnscaledViewport.centerTop - (containerHeight / scale) / 2) * scale;
        const targetLeft = (syncUnscaledViewport.centerLeft - (containerWidth / scale) / 2) * scale;

        const tolerance = Math.max(1.5, scale);
        if (wrapperRef && (Math.abs(wrapperRef.scrollTop - targetTop) > tolerance || Math.abs(wrapperRef.scrollLeft - targetLeft) > tolerance)) {
          if (typeof wrapperRef.scrollTo === 'function') {
            wrapperRef.scrollTo({ top: targetTop, left: targetLeft });
          } else {
            wrapperRef.scrollTop = targetTop;
            wrapperRef.scrollLeft = targetLeft;
          }
          scrollTop = targetTop;
          scrollLeft = targetLeft;
          lastInternalTop = targetTop;
          lastInternalLeft = targetLeft;
        }
      }
    }
  });


  $effect(() => {
    if (!iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc) return;

    const screenStyle = `
      <style>
        ::-webkit-scrollbar { display: none; }
        html { -ms-overflow-style: none; scrollbar-width: none; }
        html, body { background: ${backdropColor} !important; }
        section.page {
          box-sizing: border-box;
          box-shadow: ${mode === 'scroll' ? boxShadow : 'none'} !important;
        }
      </style>
    `;

    const printStyle = `
      <style>
        @media print {
          * { box-shadow: none !important; text-shadow: none !important; }
          html, body { background: #fff !important; }
          @page { size: 960pt 540pt; margin: 0; }
          section.page {
            width: 960pt !important;
            height: 540pt !important;
            position: relative !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      </style>
    `;

    const optimizedCommons = [...data.commons, screenStyle, printStyle];
    if (mode === 'scroll') {
      optimizedCommons.unshift(`
        <style>
          section.page {
            content-visibility: auto;
            contain-intrinsic-size: ${slideWidth}px ${slideHeight}px;
          }
        </style>
      `);
    }

    const commonsHtml = optimizedCommons.join('\n');
    const contentHtml = mode === 'scroll' 
      ? data.pages.join('\n') 
      : (data.pages[currentPageIndex] ?? '');

    const attrs = Object.entries(data.containerAttrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    const containerStyle = `
      width: ${totalInternalWidth}px; 
      height: ${totalInternalHeight}px;
      position: relative; 
      overflow: hidden;
      display: ${mode === 'scroll' ? 'flex' : 'block'};
      flex-direction: column;
      gap: ${mode === 'scroll' ? slideGap : 0}px;
      padding: ${currentPaddingY}px ${currentPaddingX}px;
      box-sizing: border-box;
      background: transparent;
    `;

    doc.body.innerHTML = `<div ${attrs} style="${containerStyle}">${commonsHtml}\n${contentHtml}</div>`;
    doc.body.style.width = `${totalInternalWidth}px`;
    doc.body.style.height = `${totalInternalHeight}px`;
    doc.body.style.overflow = 'auto';

    const firstPage = doc.querySelector('section.page') as HTMLElement | null;
    if (firstPage) {
      const w = firstPage.offsetWidth || 1920;
      const h = firstPage.offsetHeight || 1080;
      if (slideWidth !== w || slideHeight !== h || !hasMeasured) {
        slideWidth = w;
        slideHeight = h;
        hasMeasured = true;
      }
    }
  });

  $effect(() => {
    if (!wrapperRef) return;

    const isInternalUpdate = 
      Math.abs(scrollTop - lastInternalTop) < 0.1 && 
      Math.abs(scrollLeft - lastInternalLeft) < 0.1;
      
    if (isInternalUpdate) return;

    const tolerance = Math.max(1.5, scale);

    if (Math.abs(wrapperRef.scrollTop - scrollTop) > tolerance || Math.abs(wrapperRef.scrollLeft - scrollLeft) > tolerance) {
      if (typeof wrapperRef.scrollTo === 'function') {
        wrapperRef.scrollTo({ top: scrollTop, left: scrollLeft });
      } else {
        wrapperRef.scrollTop = scrollTop;
        wrapperRef.scrollLeft = scrollLeft;
      }
    }

    const win = iframeRef?.contentWindow;
    if (win && scale > 0 && typeof win.scrollTo === 'function') {
      const targetTop = scrollTop / scale;
      const targetLeft = scrollLeft / scale;
      const doc = win.document;
      const currentTop = doc.documentElement.scrollTop || doc.body.scrollTop;
      const currentLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

      if (Math.abs(currentTop - targetTop) > tolerance || Math.abs(currentLeft - targetLeft) > tolerance) {
        win.scrollTo({ top: targetTop, left: targetLeft });
      }
    }
  });

  onMount(() => {
    const div = document.createElement('div');
    div.style.width = '100px';
    div.style.height = '100px';
    div.style.overflow = 'scroll';
    div.style.position = 'absolute';
    div.style.top = '-9999px';
    document.body.appendChild(div);
    systemScrollbarWidth = 100 - div.clientWidth;
    document.body.removeChild(div);
  });
</script>

<div
  class="slide-canvas-container"
  style:width={width === 'fit-content' ? `${totalInternalWidth * scale}px` : width}
  style:height={height === 'fit-content' ? `${totalInternalHeight * scale}px` : height}
>
  <div class="size-monitor" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}></div>

  <div
    bind:this={wrapperRef}
    class="canvas-wrapper"
    class:hide-scrollbar={mode === 'scroll' && scrollbarMode === 'hidden'}
    style:overflow-y={mode === 'slide' ? (fit_mode === 'none' ? 'auto' : 'hidden') : (scrollbarMode === 'always' ? 'scroll' : 'auto')}
    style:overflow-x={fit_mode === 'none' ? 'auto' : 'hidden'}
    onscroll={handleWrapperScroll}
  >
    <div
      class="scroll-filler"
      style:width="{totalInternalWidth * scale}px"
      style:height="{totalInternalHeight * scale}px"
      style:transform="translate({offsetX}px, {offsetY}px)"
      style:transform-origin="top left"
    >
      <LaserPointerOverlay
        active={laserActive}
        x={laserX}
        y={laserY}
        {isPresenter}
      />
    </div>

    <div class="sticky-viewport">
      <iframe
        bind:this={iframeRef}
        title="Slide Render Space"
        class="slide-canvas"
        style="
          width: {scale > 0 ? containerWidth / scale : containerWidth}px;
          height: {scale > 0 ? containerHeight / scale : containerHeight}px;
          transform: translate({offsetX}px, {offsetY}px) scale({scale});
          opacity: {hasMeasured ? 1 : 0};
        "
      ></iframe>
    </div>
  </div>
</div>

<style>
  .slide-canvas-container {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }

  .size-monitor {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    visibility: hidden;
    pointer-events: none;
    overflow: hidden;
  }

  .canvas-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  .canvas-wrapper.hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .canvas-wrapper.hide-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .scroll-filler {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 10;
    pointer-events: none;
  }

  .sticky-viewport {
    position: sticky;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    pointer-events: none;
  }

  .slide-canvas {
    border: none;
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: top left;
    transition: opacity 0.15s ease;
    pointer-events: auto;
  }
</style>