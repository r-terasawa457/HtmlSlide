<script lang="ts">
  import cssContent from "../../css/slide_root.css" with { type: "text" };

  /**
   * スライドのHTMLを隔離されたiframe内に安全にレンダリングする共通コンポーネント
   */
  interface Props {
    slidesHtml: string;
    isPresentMode?: boolean;
    onIframeLoad?: (iframeDoc: Document, iframeWin: Window) => void;
  }

  let { slidesHtml, isPresentMode = false, onIframeLoad }: Props = $props();

  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let srcdoc = $state("");

  $effect(() => {
    if (!slidesHtml) {
      srcdoc = "";
      return;
    }

    srcdoc = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>${cssContent}</style>
</head>
<body class="${isPresentMode ? "present-mode" : ""}">
  ${slidesHtml}
</body>
</html>`;
    });

  /**
   * iframeの読み込み完了（onload）イベントをハンドリングし、親コンポーネントへ通知する
   */
  function handleLoad(): void {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    const iframeWin = iframeEl.contentWindow;

    if (!srcdoc || !iframeDoc?.body || iframeDoc.body.innerHTML.trim() === "") {
      return;
    }

    if (iframeWin && onIframeLoad) {
      onIframeLoad(iframeDoc, iframeWin);
    }
  }
</script>

<iframe
  bind:this={iframeEl}
  onload={handleLoad}
  srcdoc={srcdoc}
  style="width: 100%; height: 100%; border: none; overflow: hidden"
  scrolling="no"
  title={isPresentMode ? "presenter-view" : "slide-viewer"}
></iframe>