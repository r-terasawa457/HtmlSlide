<script lang="ts">
  import SlideCanvas from "./SlideCanvas.svelte";
  import LaserPointerOverlay from "./LaserPointerOverlay.svelte";
  import { createScrollController } from "./utils.svelte";
  import { getSlideDataStore } from "./SlideStore.svelte";
  import { untrack } from "svelte";

  let {
    pages: pagesProps = "__all__",
    currentPage: currentPageProp = $bindable(0),
    gap = 20,
    fitMode,
    scale: scaleProp = $bindable(1.0),
    laserPointerActive = false,
    laserTrackingActive = false,
    backgroundColor = "#F5F5F5",
  }: {
    pages: number[] | "__all__" | "__currentPage__";
    currentPage?: number;
    gap?: number;
    fitMode: "none" | "contain" | "width";
    scale?: number;
    laserPointerActive?: boolean;
    laserTrackingActive?: boolean;
    backgroundColor?: string;
  } = $props();

  const slideDataStore = getSlideDataStore();

  const pages = $derived(
    pagesProps === "__all__" ? "__all__" : [currentPageProp],
  );

  let { width: docWidth, height: docHeight } = $derived(
    slideDataStore.calculateTotalSize(pages, gap) ?? {
      width: 1280,
      height: 720,
    },
  );
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
          docWidth * scalebyContainerHeihgt <= containerWidth
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
  let offsetY = $derived.by(() => {
    return viewportHeight >= docHeight * _scale
      ? (viewportHeight - docHeight * _scale) / 2
      : 0;
  });

  let scrollTop = $state(0);
  let scrollLeft = $state(0);

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let scrollContainerRef = $state<HTMLDivElement | null>(null);

  $effect(() => {
    const targetPage = currentPageProp;

    const actualCurrentPage = untrack(() =>
      slideDataStore.calculateCurrentPageIndex(
        scrollTop,
        viewportHeight / _scale,
        pages,
        gap,
      ),
    );

    if (actualCurrentPage === undefined || targetPage === actualCurrentPage) {
      return;
    }

    const targetScrollTop = slideDataStore.calculateScrollTop(
      targetPage,
      viewportHeight / _scale,
      pages,
      gap,
    );

    if (targetScrollTop === undefined) {
      currentPageProp = actualCurrentPage;
      return;
    }

    scrollTop = targetScrollTop;

    scrollContainerRef?.scrollTo({
      // left: scrollLeft * _scale,
      top: targetScrollTop * _scale,
      behavior: "instant",
    });
  });

  function handleScroll(e: Event) {
    const scroller = e.currentTarget as HTMLDivElement;

    const maxScrollTop = Math.max(
      0,
      docHeight - (viewportHeight + offsetY * 2) / _scale,
    );
    const maxScrollLeft = Math.max(
      0,
      docWidth - (viewportWidth + offsetX * 2) / _scale,
    );

    const nextScrollTop = Math.max(
      0,
      Math.min(maxScrollTop, scroller.scrollTop / _scale),
    );
    const nextScrollLeft = Math.max(
      0,
      Math.min(maxScrollLeft, scroller.scrollLeft / _scale),
    );

    if (laserTrackingActive) {
      handlePointerMove(
        pointer.x - scrollLeft + nextScrollLeft,
        pointer.y - scrollTop + nextScrollTop,
      );
    }

    scrollTop = nextScrollTop;
    scrollLeft = nextScrollLeft;

    const calculatedPage = slideDataStore.calculateCurrentPageIndex(
      scrollTop,
      viewportHeight / _scale,
      pages,
      gap,
    );

    if (calculatedPage !== undefined && currentPageProp !== calculatedPage) {
      currentPageProp = calculatedPage;
    }
  }
  function handleIframeScroll(deltaX: number, deltaY: number) {
    if (!scrollContainerRef) return;

    let newScrollTop = scrollTop + deltaY / _scale;
    let newScrollLeft = scrollLeft + deltaX / _scale;

    const maxScrollTop = Math.max(
      0,
      docHeight - (viewportHeight + offsetY * 2) / _scale,
    );
    const maxScrollLeft = Math.max(
      0,
      docWidth - (viewportWidth + offsetX * 2) / _scale,
    );

    if (newScrollTop < 0) {
      newScrollTop = 0;
    } else if (newScrollTop > maxScrollTop) {
      newScrollTop = maxScrollTop;
    }

    if (newScrollLeft < 0) {
      newScrollLeft = 0;
    } else if (newScrollLeft > maxScrollLeft) {
      newScrollLeft = maxScrollLeft;
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

  function resizeTracker(node: HTMLElement) {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (entry.borderBoxSize?.[0]) {
        containerWidth = entry.borderBoxSize[0].inlineSize;
        containerHeight = entry.borderBoxSize[0].blockSize;
      } else {
        const rect = node.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
      }

      if (entry.contentBoxSize?.[0]) {
        innerWidth = entry.contentBoxSize[0].inlineSize;
        innerHeight = entry.contentBoxSize[0].blockSize;
      }
    });

    observer.observe(node);

    return () => observer.disconnect();
  }
</script>

<div
  {@attach scrollController.attach}
  bind:this={wrapperRef}
  class="slide-renderer"
>
  <div class="size-monitor" {@attach resizeTracker}></div>
  <div
    class="scroll-container"
    bind:this={scrollContainerRef}
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

  <SlideCanvas
    {pages}
    {gap}
    scale={_scale}
    width="{viewportWidth}px"
    height="{viewportHeight}px"
    {scrollTop}
    {scrollLeft}
    {offsetY}
    {offsetX}
    {scrollController}
  />

  {#if laserPointerActive}
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
  {/if}
</div>

<style>
  .slide-renderer {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow-y: hidden;
    overflow-x: hidden;
  }
  .size-monitor {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    overflow-y: scroll;
    overflow-x: scroll;
    visibility: hidden;
  }
  .scroll-container {
    width: 100%;
    height: 100%;
    position: absolute;
    top: 0;
    left: 0;
    overflow-y: auto;
    overflow-x: auto;
  }
</style>
