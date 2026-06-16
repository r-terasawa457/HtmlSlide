<script lang="ts">
  import { mount, unmount, onDestroy } from "svelte";
  import SlideInner from "./SlideInner.svelte";

  interface Props {
    slidesHtml: string;
    isPresentMode?: boolean;
    currentPageIndex?: number;
    hiddenPageIndices?: Set<number>;
    viewMode?: "all" | "single";
    onIframeLoad?: (iframeDoc: Document, iframeWin: Window) => void;
  }

  let {
    slidesHtml,
    isPresentMode = false,
    currentPageIndex = 0,
    hiddenPageIndices = new Set<number>(),
    viewMode = "all",
    onIframeLoad
  }: Props = $props();

  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let iframeHeight = $state("100%");
  let mountedApp: ReturnType<typeof mount> | null = null;

  const config = $state({
    slidesHtml: "",
    isPresentMode: false,
    currentPageIndex: 0,
    hiddenPageIndices: new Set<number>(),
    viewMode: "all" as "all" | "single"
  });

  $effect(() => {
    config.slidesHtml = slidesHtml;
    config.isPresentMode = isPresentMode;
    config.currentPageIndex = currentPageIndex;
    config.hiddenPageIndices = hiddenPageIndices;
    config.viewMode = viewMode;
  });

  $effect(() => {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc?.body) return;

    if (isPresentMode) {
      iframeDoc.body.classList.add("present-mode");
    } else {
      iframeDoc.body.classList.remove("present-mode");
    }
  });

  function resizeIframe(): void {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc || !iframeDoc.documentElement) return;

    const scrollHeight = iframeDoc.documentElement.scrollHeight;
    iframeHeight = `${scrollHeight}px`;
  }

  $effect(() => {
    const _trigger1 = config.slidesHtml;
    const _trigger2 = config.currentPageIndex;
    const _trigger3 = config.viewMode;
    const _trigger4 = config.hiddenPageIndices.size;

    setTimeout(() => {
      resizeIframe();
    }, 0);
  });

  // iframe内部のコンテキスト。グローバルを汚染せず、ここだけで完結します
  const srcdoc = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>
    /* ============================================================
        画面表示用の設定（ブラウザ閲覧時）
        ============================================================ */
  @media screen {
    html,
    body {
      background: transparent;
      -ms-overflow-style: none;
      scrollbar-width: none;
      margin: 0;
      padding: 0;
    }

    body::-webkit-scrollbar {
      display: none;
    }

    #slide-root {
      width: 100%;
      height: 100%;
    }

    .slides {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 0;
    }

    .page {
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
    }

    body.present-mode .slides {
      gap: 0 !important;
      background: transparent;
    }

    body.present-mode .page {
      box-shadow: none;
    }
  }

  /* ============================================================
        印刷用の設定（構文エラー修正 ＆ 影の完全根絶版）
        ============================================================ */
  @media print {
    /* 💡 【最高水準防衛】全要素の box-shadow をワイルドカードで根こそぎ一撃破壊。
        これにより、セレクタの優先順位の僅かな隙も一切許さず影を完全抹殺します。 */
    * {
      box-shadow: none !important;
      text-shadow: none !important;
    }

    /* 1. ツールバー、フルスクリーンヒントなどの画面専用UI要素を完全に非表示 */
    #fullscreen-hint,
    .separator,
    button,
    input {
      display: none !important;
    }

    /* 2. スクロール制限を100%解除 */
    html,
    body {
      overflow: visible !important;
      height: auto !important;
      background: #fff !important;
    }

    /* 4. PowerPoint標準サイズ（16:9）で出力用紙を定義 */
    @page {
      size: 960pt 540pt;
      margin: 0;
    }

    /* 5. スライドステージのレイアウトをリセット */
    .slides {
      display: block !important;
      transform: none !important;
      width: auto !important;
      height: auto !important;
      gap: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* 6. 各スライドを用紙にピクセルパーフェクトで収める */
    .page {
      width: 960pt !important;
      height: 540pt !important;
      position: relative !important;
      top: 0 !important;
      left: 0 !important;

      /* ページごとの改ページを徹底強制 */
      page-break-after: always !important;
      break-after: page !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;

      /* 背景色やシンタックスハイライトのカラーを強制出力 */
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
  </style>
</head>
<body>
</body>
</html>`;

  function handleLoad(): void {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    const iframeWin = iframeEl.contentWindow;

    if (!iframeDoc || !iframeWin) return;
    const target = iframeDoc.body;
    if (!target) return;

    if (mountedApp) {
      unmount(mountedApp);
    }

    mountedApp = mount(SlideInner, {
      target,
      props: { config }
    });

    setTimeout(() => {
      resizeIframe();
    }, 0);

    iframeWin.addEventListener("resize", resizeIframe);

    if (onIframeLoad) {
      onIframeLoad(iframeDoc, iframeWin);
    }
  }

  onDestroy(() => {
    if (mountedApp) {
      unmount(mountedApp);
    }
  });
</script>

<iframe
  bind:this={iframeEl}
  onload={handleLoad}
  {srcdoc}
  style="width: 1280px; height: {iframeHeight};"
  class="border-none m-0 p-0 overflow-hidden block"
  scrolling="no"
  title={isPresentMode ? "presenter-view" : "slide-viewer"}
></iframe>