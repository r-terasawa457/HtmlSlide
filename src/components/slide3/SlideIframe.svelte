<script lang="ts">
  import { mount, unmount } from "svelte";
  import type { ParsedSlideData } from "./types";
  import SlideDocument from "./SlideDocument.svelte";
  import { createScrollController } from "./utils.svelte";
  import srcDoc from "./slideiframe.html?raw";

  let {
    data,
    mode,
    currentPage: currentPageProp = $bindable(),
    fitMode,
    scrollbarMode,
    scale = $bindable(1.0),
    top,
    left,
    scrollController, // 親から受け取る
  }: {
    data: ParsedSlideData;
    mode: string;
    currentPage?: number;
    fitMode: "none" | "contain" | "width";
    scrollbarMode: string;
    scale?: number;
    top: number;
    left: number;
    scrollController: ReturnType<typeof createScrollController>;
  } = $props();

  let viewportWidth = $state(1280);
  let viewportHeight = $state(720);
  let docWidth = $state(1280);
  let docHeight = $state(720 * 3);

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
      props: { data: data, pages: "__all__" },
    });
    return () => unmount(slideDoc);
  });
</script>

<iframe
  {@attach (node) =>
    scrollController.attach(
      iframeReady ? node.contentDocument?.body : undefined,
    )}
  bind:this={iframeRef}
  srcdoc={srcDoc}
  onload={handleIframeLoad}
  class="slide-canvas"
  style:width="{iframeWidth}px"
  style:height="{iframeHeight}px"
  style:transform="translate({left}px, {top}px) scale({scale})"
  class:prevent-pointer-events={isScrolling}
  title="slide content"
></iframe>

<style>
  .slide-canvas {
    transform-origin: top left;
    will-change: transform;
  }
</style>
