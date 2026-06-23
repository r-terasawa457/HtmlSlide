<script lang="ts">
  import { onMount, tick } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import { parseSlidesHtml } from "../../states/ViewerState.svelte";
  import SlideCanvas from "../Slide/SlideCanvas.svelte";

  const appState = getAppState();
  const slideData = $derived(parseSlidesHtml(appState.slidesHtml));

  onMount(async () => {
    await tick();
    // SlideCanvas が iframe をロードし描画するのを少し待ってから印刷を実行
    setTimeout(() => {
      const iframe = document.querySelector(".print-isolated-container iframe") as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        const iframeWin = iframe.contentWindow;
        
        const handleAfterPrint = () => {
          iframeWin.removeEventListener("afterprint", handleAfterPrint);
          appState.clearPrintRequest();
        };

        iframeWin.addEventListener("afterprint", handleAfterPrint);
        iframeWin.focus();
        iframeWin.print();
      } else {
        window.print();
        appState.clearPrintRequest();
      }
    }, 800);
  });
</script>

<div class="print-isolated-container">
  <SlideCanvas data={slideData} mode="scroll" fit_mode="none" />
</div>

<style>
  .print-isolated-container {
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1280px;
    height: 720px;
    visibility: hidden;
    pointer-events: none;
  }
</style>