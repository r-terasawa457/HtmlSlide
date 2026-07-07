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
    scrollTop,
    scrollLeft,
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
    scrollTop: number;
    scrollLeft: number;
    onWheelDelta?: (deltaX: number, deltaY: number) => void;
  } = $props();

  let viewportWidth = $state(1280);
  let viewportHeight = $state(720);
  let docWidth = $state(1280);
  let docHeight = $state(720 * 3);

  let iframeRef = $state<HTMLIFrameElement | null>(null);

  let iframeReady = $state(false);

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

  /**
   * iframeの内部で発生したスクロールイベント（wheel / touch）を
   * 親要素（.scroll-container）に堅牢にリレーする
   */
  function trackIframeScroll(iframeNode: HTMLIFrameElement) {
    // 1. ハンドラがなければ何もせず、空のクリーンアップ関数を返す
    if (!onWheelDelta || !iframeReady) return () => {};

    const doc = iframeNode.contentDocument;
    const body = doc?.body;

    if (!body) return () => {};

    const handleWheel = (e: WheelEvent) => {
      onWheelDelta(e.deltaX, e.deltaY);
    };

    let touchStartY = 0;
    let touchStartX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        touchStartY = touch.clientY;
        touchStartX = touch.clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = touchStartX - touch.clientX;
      const deltaY = touchStartY - touch.clientY;

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
    };
  }
</script>

<iframe
  {@attach trackIframeScroll}
  bind:this={iframeRef}
  srcdoc={srcDoc}
  onload={handleIframeLoad}
  class="slide-canvas"
  style="
        width: {docWidth}px;
        height: {docHeight}px;
        transform: translate({left}px, {top}px) scale({scale});
        transform-origin: top left;
      "
  title="slide content"
></iframe>
