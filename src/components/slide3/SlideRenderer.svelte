<script lang="ts">
  import SlideIframe from "./SlideIframe.svelte";
  import LaserPointerOverlay from "./LaserPointerOverlay.svelte";
  import type { ParsedSlideData } from "./types";

  let {
    data,
    mode,
    currentPage: currentPageProp = $bindable(0),
    fitMode,
    scrollbarMode,
    scale: scaleProp = $bindable(1.0),
    laserPointerActive = false,
    laserTrackingActive = false,
  }: {
    data: ParsedSlideData;
    mode: string;
    currentPage?: number;
    fitMode: "none" | "contain" | "width";
    scrollbarMode: string;
    scale?: number;
    laserPointerActive?: boolean;
    laserTrackingActive?: boolean;
  } = $props();

  let viewportWidth = $state(1280);
  let viewportHeight = $state(720);
  let docWidth = $state(1280);
  let docHeight = $state(720 * 3);
  let currentPageHeight = $state(720);

  const pointer = $state({ x: -1, y: -1 });

  let _scale = $derived.by(() => {
    switch (fitMode) {
      case "none":
        return scaleProp;
      case "contain":
        return Math.min(
          viewportWidth / docWidth,
          viewportHeight / currentPageHeight,
        );
      case "width":
        return viewportWidth / docWidth;
      default:
        const _exhaustiveCheck: never = fitMode;
        return scaleProp;
    }
  });

  $effect(() => {
    if (fitMode in ["contain", "width"]) {
      if (scaleProp !== _scale) {
        scaleProp = _scale;
      }
    }
  });

  let offsetX = $derived.by(() => {
    return viewportWidth > docWidth * _scale
      ? (viewportWidth - docWidth * _scale) / 2
      : 0;
  });
  let offsetY = $state(0);

  let scrollTop = $state(0);
  let scrollLeft = $state(0);

  let currentPage = $state(0);

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let scrollContainerRef = $state<HTMLDivElement | null>(null);

  function handleScroll(e: Event) {
    const scroller = e.currentTarget as HTMLDivElement;
    if (laserTrackingActive) {
      handlePointerMove(
        pointer.x - scrollLeft + scroller.scrollLeft,
        pointer.y - scrollTop + scroller.scrollTop,
      );
    }
    scrollTop = scroller.scrollTop;
    scrollLeft = scroller.scrollLeft;
  }
  function handleIframeScroll(deltaX: number, deltaY: number) {
    if (!scrollContainerRef) return;
    let newScrollTop = scrollContainerRef.scrollTop + deltaY * _scale;
    let newScrollLeft = scrollContainerRef.scrollLeft + deltaX * _scale;
    if (newScrollTop < 0) {
      newScrollTop = 0;
    } else if (newScrollTop > docHeight * _scale - viewportHeight) {
      newScrollTop = docHeight * _scale - viewportHeight;
    }
    if (newScrollLeft < 0) {
      newScrollLeft = 0;
    } else if (newScrollLeft > docWidth * _scale - viewportWidth) {
      newScrollLeft = docWidth * _scale - viewportWidth;
    }
    scrollTop = newScrollTop;
    scrollLeft = newScrollLeft;
    scrollContainerRef.scrollTo(newScrollLeft, newScrollTop);
  }
  function handlePointerMove(x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
  }
</script>

<div
  bind:this={wrapperRef}
  class="canvas-wrapper"
  style="
  position: relative;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
    overflow-y: hidden;
    overflow-x: hidden;
  "
>
  <div
    class="scroll-container"
    bind:this={scrollContainerRef}
    // class:hide-scrollbar={mode === 'scroll' && scrollbarMode === 'hidden'}
    // style:overflow-y={mode === 'slide' ? (fitMode === 'none' ? 'auto' : 'hidden') : (scrollbarMode === 'always' ? 'scroll' : 'auto')}
    // style:overflow-x={fitMode === 'none' ? 'auto' : 'hidden'}
    bind:clientWidth={viewportWidth}
    bind:clientHeight={viewportHeight}
    style="
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      overflow-y: auto;
      overflow-x: auto;
      "
    onscroll={handleScroll}
  >
    <div
      class="scroll-filler"
      style:width="{docWidth * _scale}px"
      style:height="{docHeight * _scale}px"
      style:position="relative"
      style:top="{offsetY}px"
      style:left="{offsetX}px"
    ></div>
  </div>

  <div
    class="sticky-viewport-container"
    style="
    width: {viewportWidth}px;
    height: {viewportHeight}px;
    position: absolute;
    top: 0;
    left: 0;
    overflow: hidden;
    "
  >
    <SlideIframe
      {data}
      {mode}
      {fitMode}
      {scrollbarMode}
      scale={_scale}
      {scrollTop}
      {scrollLeft}
      top={offsetY - scrollTop}
      left={offsetX - scrollLeft}
      onWheelDelta={handleIframeScroll}
    />
  </div>

  <LaserPointerOverlay
    width={docWidth * _scale}
    height={docHeight * _scale}
    x={pointer.x}
    y={pointer.y}
    top={offsetY}
    left={offsetX}
    isMouseTracking={laserTrackingActive}
    onPointerMove={handlePointerMove}
  />
</div>
