<script lang="ts">
  import { mount, unmount, onDestroy } from "svelte";
  import cssContent from "../../css/slide_root.css" with { type: "text" };
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
  let iframeHeight = $state("100%"); // 高さを動的に管理するステート
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

  /**
   * iframeの内部コンテンツの高さに合わせて親のiframeの高さ（iframeHeight）を更新する
   */
  function resizeIframe(): void {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc || !iframeDoc.documentElement) return;

    // 内部ドキュメントの実際の高さを取得して反映
    const scrollHeight = iframeDoc.documentElement.scrollHeight;
    iframeHeight = `${scrollHeight}px`;
  }

  // 状態が変わって内部のDOM（表示・非表示など）が更新されたら、高さを再計算する
  $effect(() => {
    // 依存配列に reactive な値をいれることでトリガーを引く
    const _trigger1 = config.slidesHtml;
    const _trigger2 = config.currentPageIndex;
    const _trigger3 = config.viewMode;
    const _trigger4 = config.hiddenPageIndices.size;

    // DOMの更新を待ってから計算
    setTimeout(() => {
      resizeIframe();
    }, 0);
  });

  const srcdoc = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>${cssContent}</style>
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

    // マウント直後の高さを計算
    setTimeout(() => {
      resizeIframe();
    }, 0);

    // 親ウィンドウのリサイズ時にも追従させる
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
  style="width: 1280px; height: {iframeHeight}; border: none; overflow: visible;"
  scrolling="no"
  title={isPresentMode ? "presenter-view" : "slide-viewer"}
></iframe>