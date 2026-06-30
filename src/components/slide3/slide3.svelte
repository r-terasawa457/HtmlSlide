<script lang="ts">
  import { mount, unmount } from "svelte";
  import SlideDocument from "./SlideDocument.svelte";


  let viewportWidth = $state(1280)
  let viewportHeight = $state(720)
  let docWidth = $state(1280)
  let docHeight = $state(720)
  let scale = $state(1.0)

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let iframeRef = $state<HTMLIFrameElement | null>(null);

  let iframeReady = $state(false);

  function handleScroll() {

  }

  function handleIframeLoad() {
      iframeReady = true;
    }

  $effect(() => {
    if (!iframeReady || !iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc || !doc.body) return;

    const slideDoc = mount(SlideDocument, {
      target: doc.body,
      props: {}
    });
    return () => unmount(slideDoc)
  });

</script>




<div
  bind:this={wrapperRef}
  class="canvas-wrapper"
  // class:hide-scrollbar={mode === 'scroll' && scrollbarMode === 'hidden'}
  // style:overflow-y={mode === 'slide' ? (fitMode === 'none' ? 'auto' : 'hidden') : (scrollbarMode === 'always' ? 'scroll' : 'auto')}
  // style:overflow-x={fitMode === 'none' ? 'auto' : 'hidden'}
  style="
    overflow-y: auto;
    overflow-x: auto;
  "
  onscroll={handleScroll}
>
  <div class="scroll-filler" style:width="{docWidth * scale}px" style:height="{docHeight * scale}px"></div>

  <div class="sticky-viewport-container">
    <iframe
      bind:this={iframeRef}
      srcdoc="<!DOCTYPE html><html><head><style>body { margin: 0; padding: 0; overflow: hidden; } section.page.is-hidden { display: none !important; }</style></head><body></body></html>"
      onload={handleIframeLoad}
      class="slide-canvas"
      style="
        width: {docWidth}px;
        height: {docWidth}px;
        transform: translate({viewportWidth > docWidth * scale ? (viewportWidth - docWidth * scale) / 2 : 0}px, {viewportHeight > docHeight * scale ? (viewportHeight - docHeight * scale) / 2 : 0}px) scale({scale});
        transform-origin: top left;
      "
      title="slide content"
    ></iframe>
  </div>
</div>