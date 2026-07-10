<script lang="ts">
  import SlideIframe from "./SlideIframe.svelte";
  import LaserPointerOverlay from "./LaserPointerOverlay.svelte";
  import { createScrollController } from "./utils.svelte";
  import { getSlideDataStore } from "./SlideStore.svelte";
  import type { ParsedSlideData } from "./types";
  import { untrack } from "svelte";

  let {
    mode,
    currentPage: currentPageProp = $bindable(0),
    fitMode,
    scrollbarMode,
    scale: scaleProp = $bindable(1.0),
    laserPointerActive = false,
    laserTrackingActive = false,
    backgroundColor = "#F5F5F5",
  }: {
    mode: string;
    currentPage?: number;
    fitMode: "none" | "contain" | "width";
    scrollbarMode: string;
    scale?: number;
    laserPointerActive?: boolean;
    laserTrackingActive?: boolean;
    backgroundColor?: string;
  } = $props();

  const slideDataStore = getSlideDataStore();

  let docWidth = $derived(slideDataStore.slideMeta.totalSize?.width ?? 1280);
  let docHeight = $derived(slideDataStore.slideMeta.totalSize?.height ?? 720);
  let currentPageHeight = $derived(
    slideDataStore.slideMeta.pageSizes[currentPageProp]?.height ?? 720,
  );

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let innerWidth = $state(0);
  let innerHeight = $state(0);

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

  $effect(() => {
    const targetPage = currentPageProp;

    const actualCurrentPage = untrack(() =>
      slideDataStore.culculateCurrentPageIndex(
        scrollTop,
        viewportHeight / _scale,
      ),
    );

    if (actualCurrentPage !== undefined && targetPage !== actualCurrentPage) {
      const targetScrollTop = slideDataStore.calculateScrollTop(
        targetPage,
        viewportHeight / _scale,
      );

      if (targetScrollTop === undefined) {
        currentPageProp = actualCurrentPage;
        return;
      }

      const expectedPage = slideDataStore.culculateCurrentPageIndex(
        targetScrollTop,
        viewportHeight / _scale,
      );
      scrollTop = targetScrollTop;

      if (expectedPage !== undefined && targetPage !== expectedPage) {
        currentPageProp = expectedPage;
      }
    }
  });

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let scrollContainerRef = $state<HTMLDivElement | null>(null);

  function handleScroll(e: Event) {
    const scroller = e.currentTarget as HTMLDivElement;

    const nextScrollTop = scroller.scrollTop / _scale;
    const nextScrollLeft = scroller.scrollLeft / _scale;

    if (laserTrackingActive) {
      handlePointerMove(
        pointer.x - scrollLeft + nextScrollLeft,
        pointer.y - scrollTop + nextScrollTop,
      );
    }

    scrollTop = nextScrollTop;
    scrollLeft = nextScrollLeft;

    const calculatedPage = slideDataStore.culculateCurrentPageIndex(
      scrollTop,
      viewportHeight / _scale,
    );

    if (calculatedPage !== undefined && currentPageProp !== calculatedPage) {
      currentPageProp = calculatedPage;
    }
  }
  function handleIframeScroll(deltaX: number, deltaY: number) {
    if (!scrollContainerRef) return;
    let newScrollTop = scrollTop + deltaY / _scale;
    let newScrollLeft = scrollLeft + deltaX / _scale;

    if (newScrollTop < 0) {
      newScrollTop = 0;
    } else if (
      newScrollTop * _scale >
      docHeight * _scale - viewportHeight + offsetY * 2
    ) {
      newScrollTop = docHeight - viewportHeight / _scale + offsetY * 2;
    }

    if (newScrollLeft < 0) {
      newScrollLeft = 0;
    } else if (
      newScrollLeft * _scale >
      docWidth * _scale - viewportWidth + offsetX * 2
    ) {
      newScrollLeft = docWidth - viewportWidth / _scale + offsetX * 2;
    }
    scrollTop = newScrollTop;
    scrollLeft = newScrollLeft;
    scrollContainerRef.scrollTo({
      left: newScrollLeft * _scale,
      top: newScrollTop * _scale,
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
      {mode}
      scale={_scale}
      top={offsetY - scrollTop * _scale}
      left={offsetX - scrollLeft * _scale}
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
