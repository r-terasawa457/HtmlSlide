<script lang="ts">
  import { mount, unmount } from "svelte";
  import SlideDocument from "./SlideDocument.svelte";
  import { createScrollController } from "./utils.svelte";
  import { getSlideDataStore } from "./SlideStore.svelte";
  import srcDoc from "./slideiframe.html?raw";

  let {
    pages = "__all__",
    currentPage: currentPageProp = $bindable(undefined),
    gap = 0,
    scale = $bindable(1.0),
    width,
    height,
    backgroundColor = "#F5F5F5",
    scrollTop = 0,
    scrollLeft = 0,
    offsetY = 0,
    offsetX = 0,
    scrollController = undefined, // 親から受け取る
  }: {
    pages?: number[] | "__all__";
    currentPage?: number;
    gap?: number;
    scale?: number;
    width: string;
    height: string;
    backgroundColor?: string;
    scrollTop?: number;
    scrollLeft?: number;
    offsetY?: number;
    offsetX?: number;
    scrollController?: ReturnType<typeof createScrollController>;
  } = $props();

  const slideDataStore = getSlideDataStore();

  let { width: docWidth, height: docHeight } = $derived(
    slideDataStore.calculateTotalSize(pages, gap) ?? {
      width: 1280,
      height: 720,
    },
  );

  let iframeWidth = $state(0);
  let iframeHeight = $state(0);

  let iframeScaleFlag = false;

  // 3. _scale の連続変化を監視し、停止したタイミング（rAFベース）でサイズを微変動させて再描画を強制する
  $effect(() => {
    const currentScale = scale;
    docWidth;
    docHeight;

    if (currentScale <= 1.0) {
      iframeScaleFlag = false;
      iframeWidth = docWidth;
      iframeHeight = docHeight;
      return;
    }

    let rafId: number;
    const DEBOUNCE_MS = 150;
    const startTime = performance.now();

    function checkResolution(timestamp: number) {
      const elapsed = timestamp - startTime;

      if (elapsed >= DEBOUNCE_MS) {
        // 拡大時（scale > 1.0）のみ、交互切り替えでボケをクリアにする
        iframeScaleFlag = !iframeScaleFlag;
        const miniScale = iframeScaleFlag ? 1.01 : 1.0;

        iframeWidth = docWidth * miniScale;
        iframeHeight = docHeight * miniScale;
      } else {
        rafId = requestAnimationFrame(checkResolution);
      }
    }

    rafId = requestAnimationFrame(checkResolution);

    return () => cancelAnimationFrame(rafId);
  });

  let iframeRef = $state<HTMLIFrameElement | undefined>(undefined);

  let iframeReady = $state(false);

  let isScrolling = $state(false);
  let scrollTimeoutId: number | null = null;

  function handleIframeLoad() {
    iframeReady = true;
  }

  $effect(() => {
    if (!iframeReady || !iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc || !doc.body) return;

    const slideDoc = mount(SlideDocument, {
      target: doc.body,
      props: { pages: pages, gap: gap },
    });
    return () => unmount(slideDoc);
  });
</script>

<div
  class="slide-canvas-viewport"
  style:width
  style:height
  style:background={backgroundColor}
>
  <iframe
    {@attach (node) =>
      scrollController?.attach(
        iframeReady ? node.contentDocument?.body : undefined,
      )}
    bind:this={iframeRef}
    srcdoc={srcDoc}
    onload={handleIframeLoad}
    class="slide-canvas"
    style:width="{iframeWidth}px"
    style:height="{iframeHeight}px"
    style:transform="translate({offsetX - scrollLeft * scale}px, {offsetY -
      scrollTop * scale}px) scale({scale})"
    class:prevent-pointer-events={isScrolling}
    title="slide content"
  ></iframe>
</div>

<style>
  .slide-canvas-viewport {
    position: absolute;
    top: 0;
    left: 0;
    transform: translate(0, 0);
    overflow: hidden;
  }
  .slide-canvas {
    transform-origin: top left;
    will-change: transform;
  }
</style>
