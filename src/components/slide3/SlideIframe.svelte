<script lang="ts">
  import { mount, unmount } from "svelte";
  import type { ParsedSlideData } from "./types";
  import SlideDocument from "./SlideDocument.svelte";
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
    onWheelDelta,
  }: {
    data: ParsedSlideData;
    mode: string;
    currentPage?: number;
    fitMode: "none" | "contain" | "width";
    scrollbarMode: string;
    scale?: number;
    top: number;
    left: number;
    onWheelDelta?: (deltaX: number, deltaY: number) => void;
  } = $props();

  let viewportWidth = $state(1280);
  let viewportHeight = $state(720);
  let docWidth = $state(1280);
  let docHeight = $state(720 * 3);

  let iframeRef = $state<HTMLIFrameElement | null>(null);

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
      props: { data: data },
    });
    return () => unmount(slideDoc);
  });

  // スクロール状態のタイマー管理（デバウンス）
  function activateScrollLock() {
    isScrolling = true;
    if (scrollTimeoutId) clearTimeout(scrollTimeoutId);

    scrollTimeoutId = window.setTimeout(() => {
      isScrolling = false;
      scrollTimeoutId = null;
    }, 150);
  }

  function trackIframeScroll(iframeNode: HTMLIFrameElement) {
    if (!onWheelDelta || !iframeReady) return () => {};

    const doc = iframeNode.contentDocument;
    const body = doc?.body;
    if (!body) return () => {};

    // 2. ホイールイベントの処理
    const handleWheel = (e: WheelEvent) => {
      activateScrollLock();

      // 既存の親への通知を実行
      onWheelDelta(e.deltaX, e.deltaY);
    };

    let touchStartY = 0;
    let touchStartX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touchStartX - touch.clientX;
      const deltaY = touchStartY - touch.clientY;

      activateScrollLock();
      onWheelDelta(deltaX, deltaY);

      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    };

    body.addEventListener("wheel", handleWheel, { passive: true });
    body.addEventListener("touchstart", handleTouchStart, { passive: true });
    body.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      body.removeEventListener("wheel", handleWheel);
      body.removeEventListener("touchstart", handleTouchStart);
      body.removeEventListener("touchmove", handleTouchMove);
      if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
    };
  }
</script>

<iframe
  {@attach trackIframeScroll}
  bind:this={iframeRef}
  srcdoc={srcDoc}
  onload={handleIframeLoad}
  class="slide-canvas"
  style:width="{docWidth}px"
  style:height="{docHeight}px"
  style:transform="translate({left}px, {top}px) scale({scale})"
  class:prevent-pointer-events={isScrolling}
  title="slide content"
></iframe>

<style>
  .slide-canvas {
    transform-origin: top left;
  }
</style>
