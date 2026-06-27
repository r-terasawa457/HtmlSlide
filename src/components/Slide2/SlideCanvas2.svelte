<script lang="ts">
  /**
   * @file SlideCanvas2.svelte
   * @description 幾何計算・調停（Orchestrator）を一元管理する最上位スライドキャンバス。
   */

  import { onMount } from "svelte";
  import type { SlideCanvasProps } from "./SlideCanvasProps";
  import { SlideGeometry, type SlideGeometryContext } from "./SlideGeometry";
  import CanvasWrapper from "./CanvasWrapper.svelte";
  import { slide } from "svelte/transition";

  let {
    data,
    mode,
    width = "100%",
    height = "100%",
    slideGap = 0,
    boxShadow = "none",
    scrollbarMode = "auto",
    fitMode = "contain",
    currentPageIndex = $bindable(0),
    scale = $bindable(1.0),
    viewportInfo = $bindable({ centerX: 0, centerY: 0, width: 0, height: 0 }),
    laserInfo = $bindable({ unscaledX: -1, unscaledY: -1 }),
    laserTracking = false,
    onLasermove,
    onkeydown,
    onContentSizeChange
  }: SlideCanvasProps = $props();

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let pageWidth = $state(0);
  let pageHeight = $state(0);
  let contentHeight = $state(0);
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
  let systemScrollbarWidth = $state(0);

  const shadowPaddingX = 20;
  const shadowPaddingY = $derived(mode === "scroll" ? slideGap : 0);

  let effectiveFitMode = $derived(
    width === "fit-content" || height === "fit-content" ? "none" : fitMode
  );

  let ctx = $derived<SlideGeometryContext>({
    containerWidth,
    containerHeight,
    pageWidth,
    pageHeight,
    mode,
    fitMode: effectiveFitMode,
    scrollbarMode,
    systemScrollbarWidth,
    slideGap
  });

  let calculated = $derived.by(() => SlideGeometry.calculate(ctx, contentHeight, scale))
  let effectiveWidth  = $derived(calculated.effectiveWidth);
  let currentScale    = $derived(calculated.scale);

  let currentPaddingX = $derived(SlideGeometry.calculatePaddingX(ctx, effectiveWidth, currentScale, shadowPaddingX));

  let totalInternalWidth  = $derived(pageWidth + currentPaddingX * 2);
  let totalInternalHeight = $derived(contentHeight + shadowPaddingY * 2);

  
  let scrollFillerWidth  = $derived(totalInternalWidth * currentScale);
  let scrollFillerHeight = $derived(totalInternalHeight * currentScale);

  let offsets = $derived(SlideGeometry.calculateOffset(ctx, effectiveWidth, totalInternalWidth, totalInternalHeight));
  let iframeWidth        = $derived(currentScale > 0 ? containerWidth / currentScale : containerWidth);
  let iframeHeight       = $derived(currentScale > 0 ? containerHeight / currentScale : containerHeight);

  let laserPhysical = $derived(
    SlideGeometry.calculatePhysicalLaserPosition(
      laserInfo ?? { unscaledX: -1, unscaledY: -1 },
      currentScale,
      scrollLeft,
      scrollTop,
      offsets.x,
      offsets.y
    )
  );

  /**
   * ユーザー主導のスクロールイベントを処理し、ビューポートとインデックスの状態を一元的に更新する。
   */
  function handleWrapperScroll(top: number, left: number) {
    scrollTop = top;
    scrollLeft = left;

    if (fitMode !== "viewport") {
      viewportInfo = SlideGeometry.calculateViewportInfo(ctx, top, left, currentScale);

      if (mode === "scroll" && pageHeight > 0) {
        const internalScrollTop = top / (currentScale || 1.0);
        const adjustedScrollTop = Math.max(0, internalScrollTop - shadowPaddingY);
        const pitch = pageHeight + slideGap;
        const computedIndex = Math.max(
          0,
          Math.min(data.pages.length - 1, Math.round(adjustedScrollTop / pitch))
        );

        if (currentPageIndex !== computedIndex) {
          currentPageIndex = computedIndex;
        }
      }
    }
  }

  /**
   * 外部要因（fitMode変更や通常スケール変更）によるスケールの番人エフェクト。
   */
  $effect(() => {
    if (fitMode !== "viewport") {
      scale = currentScale;
    }
  });

  /**
   * 外部からの追従リクエスト（"viewport" モード）に対する受動的同期エフェクト。
   */
  $effect(() => {
    if (fitMode === "viewport" && viewportInfo) {
      const target = SlideGeometry.calculateTargetScrollForViewport(ctx, viewportInfo);
      const tolerance = Math.max(1.5, target.scale);

      if (Math.abs(scrollTop - target.scrollTop) > tolerance) scrollTop = target.scrollTop;
      if (Math.abs(scrollLeft - target.scrollLeft) > tolerance) scrollLeft = target.scrollLeft;

      scale = target.scale;
    }
  });

  /**
   * 外部またはロジック起点のインデックス変更要求に対するページスナップ強制同期エフェクト。
   */
  $effect(() => {
    if (mode === "scroll") {
      const targetTop = SlideGeometry.calculateTargetScrollForPage(
        ctx,
        currentPageIndex ?? 0,
        shadowPaddingY,
        currentScale
      );

      const tolerance = Math.max(1.5, currentScale);
      if (Math.abs(scrollTop - targetTop) > tolerance) {
        scrollTop = targetTop;
      }
    }
  });

  $effect(() => {
    if (onContentSizeChange) {
      onContentSizeChange(scrollFillerWidth, scrollFillerHeight);
    }
  });

  function handleMouseMove(e: MouseEvent) {
    if (!laserTracking) return;

    const targetDoc = e.currentTarget as Document | null;
    const iframeScrollLeft = targetDoc?.documentElement.scrollLeft || targetDoc?.body.scrollLeft || 0;
    const iframeScrollTop = targetDoc?.documentElement.scrollTop || targetDoc?.body.scrollTop || 0;

    const calculatedLaser = SlideGeometry.calculateUnscaledMousePosition(
      e.clientX,
      e.clientY,
      iframeScrollLeft,
      iframeScrollTop,
      totalInternalWidth,
      totalInternalHeight
    );

    laserInfo = calculatedLaser;
    if (onLasermove) onLasermove(calculatedLaser);
  }

  function handleMouseLeave() {
    if (!laserTracking) return;
    const emptyLaser = { unscaledX: -1, unscaledY: -1 };
    laserInfo = emptyLaser;
    if (onLasermove) onLasermove(emptyLaser);
  }

  function handleMeasuredSize(width: number, height: number, totalHeight: number) {
    if (pageWidth !== width || pageHeight !== height || contentHeight !== totalHeight) {
      pageWidth = width;
      pageHeight = height;
      contentHeight = totalHeight;
    }
  }

  onMount(() => {
    const div = document.createElement("div");
    div.style.width = "100px";
    div.style.height = "100px";
    div.style.overflow = "scroll";
    div.style.position = "absolute";
    div.style.top = "-9999px";
    document.body.appendChild(div);
    systemScrollbarWidth = 100 - div.clientWidth;
    document.body.removeChild(div);
  });
</script>

<div
  class="slide-canvas-container"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  style:width={width === "fit-content" ? `${scrollFillerWidth}px` : width}
  style:height={height === "fit-content" ? `${scrollFillerHeight}px` : height}
>
  <CanvasWrapper
    {data}
    {mode}
    {currentPageIndex}
    fitMode={effectiveFitMode}
    {scrollbarMode}
    backdropColor="transparent"
    {boxShadow}
    {slideGap}
    scale={currentScale}
    offsetX={offsets.x}
    offsetY={offsets.y}
    {scrollFillerWidth}
    {scrollFillerHeight}
    {iframeWidth}
    {iframeHeight}
    laserIsActive={true}
    laserPhysicalX={laserPhysical.x}
    laserPhysicalY={laserPhysical.y}
    bind:scrollTop
    bind:scrollLeft
    onscroll={handleWrapperScroll}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    {onkeydown}
    onMeasuredSize={handleMeasuredSize}
  />
</div>

<style>
  .slide-canvas-container {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }
</style>