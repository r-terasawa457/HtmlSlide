<script lang="ts">
  import { onMount, tick } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import SlideCanvas from "../slide3/SlideCanvas.svelte";

  import {
    type SlideData,
    getSlideDataStore,
  } from "../slide3/SlideStore.svelte";

  const appState = getAppState();
  const slideDataStore = getSlideDataStore();

  onMount(async () => {
    await tick();
    // SlideCanvas が iframe をロードし描画するのを少し待ってから印刷を実行
    setTimeout(() => {
      const iframe = document.querySelector(
        ".print-isolated-container iframe",
      ) as HTMLIFrameElement | null;
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
  <SlideCanvas width="fit-content" height="fit-content" />
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
