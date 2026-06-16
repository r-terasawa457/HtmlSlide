<script lang="ts">
  import { tick } from "svelte";
  import { getAppState } from "../../states/AppState.svelte";
  import SlideIframe from "../Common/SlideIframe.svelte";

  const appState = getAppState();

  /**
   * iframeの読み込み完了時に印刷ダイアログを起動し、終了ライフサイクルを管理します。
   */
  async function handlePrintInit(_doc: Document, iframeWin: Window): Promise<void> {
    await tick();

    const handleAfterPrint = () => {
      iframeWin.removeEventListener("afterprint", handleAfterPrint);

      // ブラウザの印刷スレッド脱出後に安全に状態をクリア
      setTimeout(() => {
        appState.clearPrintRequest();
      }, 0);
    };

    iframeWin.addEventListener("afterprint", handleAfterPrint);
    
    iframeWin.focus();
    iframeWin.print();
  }
</script>

<div class="print-isolated-container">
  <SlideIframe slidesHtml={appState.slidesHtml} onIframeLoad={handlePrintInit} />
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