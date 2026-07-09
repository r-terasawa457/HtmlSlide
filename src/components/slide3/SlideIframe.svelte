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

  const scrollController = createScrollController((x: number, y: number) =>
    onWheelDelta?.(x, y),
  );
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
  style:width="{docWidth}px"
  style:height="{docHeight}px"
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
