<script lang="ts">
  /**
   * @file SlideCanvas.svelte
   * @description Svelte 5 Runeシステムおよび完全ステートレス幾何計算エンジンに完全最適化された次世代スライドレンダラー。
   */

  import { onMount } from 'svelte';
  import { SlideGeometry, type SlideGeometryContext, type ViewportInfo, type LaserInfo } from './SlideGeometry';
  import type { ParsedSlideData } from './types';

  let {
    data,
    mode = 'slide',
    fitMode = 'contain',
    currentPageIndex = $bindable(0),
    scale = $bindable(1.0),
    viewportInfo = $bindable({ centerX: 0, centerY: 0, width: 0, height: 0 }),
    laserInfo = $bindable({ unscaledX: -1, unscaledY: -1 }),
    width = '100%',
    height = '100%',
    slideGap = 0,
    boxShadow = 'none',
    scrollbarMode = 'auto',
    backdropColor = 'transparent',
    shadowPaddingX = 20,
    shadowPaddingY = slideGap,
    laserTracking = false,
    isPresenter = false,
    onLasermove,
    onkeydown,
    onContentSizeChange
  } = $props<{
    data: ParsedSlideData;
    mode?: 'scroll' | 'slide';
    fitMode?: 'contain' | 'width' | 'viewport' | 'none';
    currentPageIndex?: number;
    scale?: number;
    viewportInfo?: ViewportInfo;
    laserInfo?: LaserInfo;
    width?: string;
    height?: string;
    slideGap?: number;
    boxShadow?: string;
    scrollbarMode?: 'always' | 'hidden' | 'auto';
    backdropColor?: string;
    shadowPaddingX?: number;
    shadowPaddingY?: number;
    laserTracking?: boolean;
    isPresenter?: boolean;
    onLasermove?: (info: LaserInfo) => void;
    onkeydown?: (e: KeyboardEvent) => void;
    onContentSizeChange?: (w: number, h: number) => void;
  }>();

  // --- 内部物理状態 ($state) ---
  let wrapperRef = $state<HTMLDivElement | null>(null);
  let iframeRef = $state<HTMLIFrameElement | null>(null);
  
  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let slideWidth = $state(1920);
  let slideHeight = $state(1080);
  
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
  
  let hasMeasured = $state(false);
  let systemScrollbarWidth = $state(0);
  let ticking = false;

  // 衝突ガード用インデックススタンプ
  let lastProcessedIndex = currentPageIndex;

  // エッジケースのクランプ：fit-content指定時は強制的にフィット無効(none)にする
  let resolvedFitMode = $derived(width === 'fit-content' || height === 'fit-content' ? 'none' : fitMode);

  // --- 宣言的データフロー ($derived) ---
  let ctx = $derived<SlideGeometryContext>({
    containerWidth,
    containerHeight,
    slideWidth,
    slideHeight,
    mode,
    fitMode: resolvedFitMode,
    scrollbarMode,
    systemScrollbarWidth,
    slideGap
  });

  let pureTotalHeight = $derived(SlideGeometry.calculatePureTotalHeight(ctx, data.pages.length));
  let effectiveWidth  = $derived(SlideGeometry.calculateEffectiveWidth(ctx, pureTotalHeight));
  let currentScale    = $derived(SlideGeometry.calculateCurrentScale(ctx, effectiveWidth, scale, viewportInfo));

  let currentPaddingX = $derived(SlideGeometry.calculatePaddingX(ctx, effectiveWidth, currentScale, shadowPaddingX));
  let currentPaddingY = $derived(mode === 'scroll' ? shadowPaddingY : 0);

  let totalInternalWidth  = $derived(slideWidth + currentPaddingX * 2);
  let totalInternalHeight = $derived(pureTotalHeight + currentPaddingY * 2);

  let offsets = $derived(SlideGeometry.calculateOffset(ctx, effectiveWidth, totalInternalWidth, totalInternalHeight, currentScale));

  // レーザーポインターの固定層ViewPortマッピング物理座標の算出
  let physicalLaser = $derived(
    SlideGeometry.calculatePhysicalLaserPosition(
      laserInfo.unscaledX,
      laserInfo.unscaledY,
      currentScale,
      scrollLeft,
      scrollTop,
      offsets.x,
      offsets.y
    )
  );

  // --- スクロール・レート制御（rAF間引き） ---
  function syncPhysicalScrollState(targetTop: number, targetLeft: number) {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        scrollTop = targetTop;
        scrollLeft = targetLeft;

        // iframe内部ドキュメントへのネイティブスクロールリレー
        const win = iframeRef?.contentWindow;
        if (win && currentScale > 0 && typeof win.scrollTo === 'function') {
          win.scrollTo({ top: targetTop / currentScale, left: targetLeft / currentScale });
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  function handleWrapperScroll() {
    if (!wrapperRef) return;
    syncPhysicalScrollState(wrapperRef.scrollTop, wrapperRef.scrollLeft);
  }

  function handleIframeScroll() {
    const doc = iframeRef?.contentDocument;
    if (!doc) return;
    const iframeTop = doc.documentElement.scrollTop || doc.body.scrollTop;
    const iframeLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

    const expectedParentTop = iframeTop * currentScale;
    const expectedParentLeft = iframeLeft * currentScale;

    const tolerance = Math.max(1.5, currentScale);
    if (Math.abs(scrollTop - expectedParentTop) > tolerance || Math.abs(scrollLeft - expectedParentLeft) > tolerance) {
      wrapperRef?.scrollTo({ top: expectedParentTop, left: expectedParentLeft });
      syncPhysicalScrollState(expectedParentTop, expectedParentLeft);
    }
  }

  // --- マウス・インタラクションハンドラ ---
  function handleIframeMouseMove(e: MouseEvent) {
    if (!isPresenter || !laserTracking) return;
    const doc = iframeRef?.contentDocument;
    if (!doc) return;

    const iframeTop = doc.documentElement.scrollTop || doc.body.scrollTop;
    const iframeLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

    const computedLaser = SlideGeometry.calculateUnscaledMousePosition(
      e.clientX, e.clientY, iframeLeft, iframeTop, totalInternalWidth, totalInternalHeight
    );

    laserInfo = computedLaser;
    if (onLasermove) onLasermove(computedLaser);
  }

  function handleIframeMouseLeave() {
    if (!isPresenter || !laserTracking) return;
    const fallbackLaser = { unscaledX: -1, unscaledY: -1 };
    laserInfo = fallbackLaser;
    if (onLasermove) onLasermove(fallbackLaser);
  }

  // --- サイドエフェクトタスク群 ($effect) ---
  
  // 外枠サイズ決定変更の通知
  $effect(() => {
    if (onContentSizeChange && hasMeasured) {
      onContentSizeChange(totalInternalWidth * currentScale, totalInternalHeight * currentScale);
    }
  });

  // 主導権（Ownership）の交通整理
  $effect(() => {
    if (resolvedFitMode !== 'viewport') {
      scale = currentScale;
      viewportInfo = SlideGeometry.calculateViewportInfo(ctx, scrollTop, scrollLeft, currentScale);
    } else {
      const target = SlideGeometry.calculateTargetScrollForViewport(ctx, viewportInfo);
      const tolerance = Math.max(1.5, target.scale);
      if (Math.abs(scrollTop - target.scrollTop) > tolerance || Math.abs(scrollLeft - target.scrollLeft) > tolerance) {
        wrapperRef?.scrollTo({ top: target.scrollTop, left: target.scrollLeft });
        scrollTop = target.scrollTop;
        scrollLeft = target.scrollLeft;
      }
      scale = target.scale;
    }
  });

  // 衝突ガード付きページスナップエフェクト
  $effect(() => {
    if (currentPageIndex !== lastProcessedIndex && mode === 'scroll') {
      const targetTop = SlideGeometry.calculateTargetScrollForPage(ctx, currentPageIndex, currentPaddingY, currentScale);
      const tolerance = Math.max(1.5, currentScale);
      if (Math.abs(scrollTop - targetTop) > tolerance) {
        wrapperRef?.scrollTo({ top: targetTop, behavior: 'auto' });
        scrollTop = targetTop;
      }
      lastProcessedIndex = currentPageIndex;
    }
  });

  // スクロール追従型アクティブページインデックス逆算エフェクト
  $effect(() => {
    if (mode === 'scroll' && resolvedFitMode !== 'viewport' && slideHeight > 0) {
      const internalScrollTop = scrollTop / (currentScale || 1.0);
      const adjustedScrollTop = Math.max(0, internalScrollTop - currentPaddingY);
      const pitch = slideHeight + slideGap;
      const computedIndex = Math.max(0, Math.min(data.pages.length - 1, Math.round(adjustedScrollTop / pitch)));
      
      if (currentPageIndex !== computedIndex) {
        currentPageIndex = computedIndex;
        lastProcessedIndex = computedIndex;
      }
    }
  });

  // スライドデータのDOM構築および初回実寸計測ライフサイクル
  $effect(() => {
    if (!iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc) return;

    // スタイルシート文字列のアセンブル
    const baseStyles = `
      <style>
        ::-webkit-scrollbar { display: none; }
        html { -ms-overflow-style: none; scrollbar-width: none; }
        html, body { margin: 0; padding: 0; background: ${backdropColor} !important; margin: 0; padding: 0; }
        section.page { box-sizing: border-box; box-shadow: ${mode === 'scroll' ? boxShadow : 'none'} !important; }
        @media print {
          * { box-shadow: none !important; text-shadow: none !important; }
          html, body { background: #fff !important; }
          @page { size: 960pt 540pt; margin: 0; }
          section.page {
            width: 960pt !important; height: 540pt !important;
            position: relative !important; page-break-after: always !important;
            break-after: page !important; page-break-inside: avoid !important;
            break-inside: avoid !important; print-color-adjust: exact; -webkit-print-color-adjust: exact;
          }
        }
      </style>
    `;

    const optimizedCommons = [...data.commons, baseStyles];
    if (mode === 'scroll') {
      optimizedCommons.unshift(`<style>section.page { content-visibility: auto; contain-intrinsic-size: ${slideWidth}px ${slideHeight}px; }</style>`);
    }

    const containerStyle = `
      width: ${totalInternalWidth}px; height: ${totalInternalHeight}px;
      position: relative; overflow: hidden; display: ${mode === 'scroll' ? 'flex' : 'block'};
      flex-direction: column; gap: ${mode === 'scroll' ? slideGap : 0}px;
      padding: ${currentPaddingY}px ${currentPaddingX}px; box-sizing: border-box; background: transparent;
    `;

    const attrs = Object.entries(data.containerAttrs).map(([k, v]) => `${k}="${v}"`).join(' ');
    const contentHtml = mode === 'scroll' ? data.pages.join('\n') : (data.pages[currentPageIndex] ?? '');

    doc.body.innerHTML = `<div ${attrs} style="${containerStyle}">${optimizedCommons.join('\n')}\n${contentHtml}</div>`;
    doc.body.style.width = `${totalInternalWidth}px`;
    doc.body.style.height = `${totalInternalHeight}px`;
    doc.body.style.overflow = 'auto';

    // 初回レンダリングの実寸法自動キャッチ
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

  // iframe内部イベントリスナーのアタッチ隔離
  $effect(() => {
    if (!iframeRef) return;
    const win = iframeRef.contentWindow;
    const doc = iframeRef.contentDocument;
    if (!win || !doc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (onkeydown) onkeydown(e);
    };

    win.addEventListener('scroll', handleIframeScroll, { passive: true });
    win.addEventListener('keydown', handleKeyDown);
    win.addEventListener('mousemove', handleIframeMouseMove, { passive: true });
    doc.addEventListener('mouseleave', handleIframeMouseLeave);

    if (isPresenter && laserTracking) {
      doc.body.style.cursor = 'none';
    } else {
      doc.body.style.cursor = 'default';
    }

    return () => {
      win.removeEventListener('scroll', handleIframeScroll);
      win.removeEventListener('keydown', handleKeyDown);
      win.removeEventListener('mousemove', handleIframeMouseMove);
      doc.removeEventListener('mouseleave', handleIframeMouseLeave);
    };
  });

  // システムスクロールバー幅の自動計測
  onMount(() => {
    const div = document.createElement('div');
    div.style.cssText = 'width:100px;height:100px;overflow:scroll;position:absolute;top:-9999px;';
    document.body.appendChild(div);
    systemScrollbarWidth = 100 - div.clientWidth;
    document.body.removeChild(div);
  });
</script>

<div
  class="slide-canvas-container"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  style:width={width === 'fit-content' ? `${totalInternalWidth * currentScale}px` : width}
  style:height={height === 'fit-content' ? `${totalInternalHeight * currentScale}px` : height}
>
  <div
    bind:this={wrapperRef}
    class="canvas-wrapper"
    class:hide-scrollbar={mode === 'scroll' && scrollbarMode === 'hidden'}
    style:overflow-y={mode === 'slide' ? (resolvedFitMode === 'none' ? 'auto' : 'hidden') : (scrollbarMode === 'always' ? 'scroll' : 'auto')}
    style:overflow-x={resolvedFitMode === 'none' ? 'auto' : 'hidden'}
    onscroll={handleWrapperScroll}
  >
    <div
      class="scroll-filler"
      style:width="{totalInternalWidth * currentScale}px"
      style:height="{totalInternalHeight * currentScale}px"
    ></div>

    <div class="sticky-viewport-container">
      <iframe
        bind:this={iframeRef}
        title="Slide Render Space"
        class="slide-canvas"
        style="
          width: {currentScale > 0 ? containerWidth / currentScale : containerWidth}px;
          height: {currentScale > 0 ? containerHeight / currentScale : containerHeight}px;
          transform: translate({offsets.x}px, {offsets.y}px) scale({currentScale});
          opacity: {hasMeasured ? 1 : 0};
        "
      ></iframe>

      {#if laserTracking && physicalLaser.x !== -1 && physicalLaser.y !== -1}
        <div class="laser-pointer-layer">
          <div 
            class="laser-dot" 
            style:left="{physicalLaser.x}px" 
            style:top="{physicalLaser.y}px"
          ></div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .slide-canvas-container {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
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

  .sticky-viewport-container {
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

  .laser-pointer-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 90;
    pointer-events: none;
  }

  .laser-dot {
    position: absolute;
    width: 12px;
    height: 12px;
    background-color: #ff1744;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 24px #ff1744, 0 0 48px #ff1744;
    will-change: left, top;
  }
</style>