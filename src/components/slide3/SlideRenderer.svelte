<script lang="ts">
  import SlideIframe from "./SlideIframe.svelte";
  import LaserPointerOverlay from "./LaserPointerOverlay.svelte";
  import { createScrollController } from "./utils.svelte";
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
    backgroundColor = "#F5F5F5",
  }: {
    data: ParsedSlideData;
    mode: string;
    currentPage?: number;
    fitMode: "none" | "contain" | "width";
    scrollbarMode: string;
    scale?: number;
    laserPointerActive?: boolean;
    laserTrackingActive?: boolean;
    backgroundColor?: string;
  } = $props();

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let innerWidth = $state(0);
  let innerHeight = $state(0);

  let docWidth = $state(1280);
  let docHeight = $state(720 * 3);
  let currentPageHeight = $state(720);

  const pointer = $state({ x: -1, y: -1 });

  let _scale = $derived.by(() => {
    switch (fitMode) {
      case "none":
        return scaleProp;
      case "contain":
        const scalebyContainerWidth = containerWidth / docWidth;
        const scalebyWidth =
          docHeight * scalebyContainerWidth <= containerHeight
            ? scalebyContainerWidth
            : innerWidth / docWidth;
        const scalebyContainerHeihgt = containerHeight / currentPageHeight;
        const scalebyHeight =
          docWidth * scalebyContainerHeihgt <= containerHeight
            ? scalebyContainerHeihgt
            : innerHeight / currentPageHeight;
        return Math.min(scalebyWidth, scalebyHeight);
      case "width":
        const scalebyContainer = containerWidth / docWidth;
        return docHeight * scalebyContainer <= containerHeight
          ? scalebyContainer
          : innerWidth / docWidth;
      default:
        const _exhaustiveCheck: never = fitMode;
        return scaleProp;
    }
  });

  let viewportWidth: number = $derived(
    docHeight * _scale <= containerHeight ? containerWidth : innerWidth,
  );
  let viewportHeight: number = $derived(
    docWidth * _scale <= containerWidth ? containerHeight : innerHeight,
  );

  $effect(() => {
    if (["contain", "width"].includes(fitMode)) {
      console.log(_scale);
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
    let newScrollTop = scrollTop + deltaY * _scale;
    let newScrollLeft = scrollLeft + deltaX * _scale;

    if (newScrollTop < 0) {
      newScrollTop = 0;
    } else if (
      newScrollTop >
      docHeight * _scale - viewportHeight + offsetY * 2
    ) {
      newScrollTop = docHeight * _scale - viewportHeight + offsetY * 2;
    }

    if (newScrollLeft < 0) {
      newScrollLeft = 0;
    } else if (
      newScrollLeft >
      docWidth * _scale - viewportWidth + offsetX * 2
    ) {
      newScrollLeft = docWidth * _scale - viewportWidth + offsetX * 2;
    }
    scrollTop = newScrollTop;
    scrollLeft = newScrollLeft;
    scrollContainerRef.scrollTo({
      left: newScrollLeft,
      top: newScrollTop,
      behavior: "instant",
    });
  }
  function handlePointerMove(x: number, y: number) {
    pointer.x = x;
    pointer.y = y;
  }

  const scrollController = createScrollController((x: number, y: number) =>
    handleIframeScroll(x, y),
  );
</script>

<div
  {@attach scrollController.attach}
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
    class="size-monitor"
    bind:offsetWidth={containerWidth}
    bind:offsetHeight={containerHeight}
    bind:clientWidth={innerWidth}
    bind:clientHeight={innerHeight}
    style="
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      overflow-y: scroll;
      overflow-x: scroll;
      visibility: hidden;
      "
  ></div>
  <div
    class="scroll-container"
    bind:this={scrollContainerRef}
    // class:hide-scrollbar={mode === 'scroll' && scrollbarMode === 'hidden'}
    // style:overflow-y={mode === 'slide' ? (fitMode === 'none' ? 'auto' : 'hidden') : (scrollbarMode === 'always' ? 'scroll' : 'auto')}
    // style:overflow-x={fitMode === 'none' ? 'auto' : 'hidden'}
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
    background: {backgroundColor};
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
      top={offsetY - scrollTop}
      left={offsetX - scrollLeft}
      {scrollController}
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
