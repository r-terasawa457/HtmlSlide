<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { viewerState } from "../../scripts/ViewerState.svelte";
  import { AssetProvider } from "../../scripts/AssetProvider";

  const BASE_WIDTH = 1280;
  const BASE_HEIGHT = 720;

  let iframeEl = $state<HTMLIFrameElement | null>(null);
  let wrapperEl = $state<HTMLElement | null>(null);
  let viewerContainerEl = $state<HTMLElement | null>(null);
  let srcdoc = $state("");
  let isIframeLoaded = $state(false);

  // 外部(ControlBar)から印刷をトリガーできるように公開するメソッド用インターフェース
  interface Props {
    refPrint: { print: () => void } | undefined;
  }
  let { refPrint = $bindable() }: Props = $props();

  async function createSrcDoc(slidesHtml: string): Promise<string> {
    const cssContent = await AssetProvider.resolveStyleTag(
      "src/css/slide_root.css",
    );

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  </style>
</head>
<body>
  ${slidesHtml}
  ${cssContent}
</body>
</html>`;
  }

  // slidesHtmlが変更された時にsrcdocを生成する
  $effect(() => {
    if (viewerState.slidesHtml) {
      createSrcDoc(viewerState.slidesHtml).then((doc) => {
        srcdoc = doc;
        isIframeLoaded = false;
      });
    }
  });

  function applyZoom(): void {
    if (!iframeEl || !wrapperEl || !isIframeLoaded) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc) return;

    const slidesEl = iframeDoc.querySelector(".slides") as HTMLElement | null;
    if (!slidesEl) return;

    const currentZoom = viewerState.currentZoom;

    slidesEl.style.transformOrigin = "top left";
    slidesEl.style.transform = `scale(${currentZoom})`;
    slidesEl.style.width = `${BASE_WIDTH}px`;

    const unscaledHeight = slidesEl.scrollHeight;
    wrapperEl.style.width = `${BASE_WIDTH * currentZoom}px`;
    wrapperEl.style.height = `${unscaledHeight * currentZoom}px`;
    wrapperEl.style.margin = "0 auto";
  }

  function updateLayout(): void {
    if (!viewerContainerEl) return;
    const vW = viewerContainerEl.clientWidth;
    const vH = viewerContainerEl.clientHeight;
    viewerState.updateLayout(vW, vH, BASE_WIDTH, BASE_HEIGHT);
    applyZoom();
  }

  function scrollToPage(pageNumber: number, smooth = true): void {
    if (!iframeEl || !viewerContainerEl || !isIframeLoaded) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc) return;

    const target = iframeDoc.getElementById("slide-" + pageNumber);
    if (target) {
      viewerContainerEl.scrollTo({
        top: target.offsetTop * viewerState.currentZoom,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  function handleIframeLoad() {
    if (!iframeEl) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc) return;

    const pages = iframeDoc.querySelectorAll(".page");
    viewerState.totalPages = pages.length;
    isIframeLoaded = true;

    // 初期レイアウト算出
    updateLayout();

    // 読み込み完了後にスクロール位置を調整
    scrollToPage(viewerState.currentPage, false);

    // iframe内のキーボードイベント
    if (iframeEl.contentWindow) {
      iframeEl.contentWindow.addEventListener("keydown", handleKeyDown);
    }
  }

  function printSlides(): void {
    if (iframeEl?.contentWindow) {
      iframeEl.contentWindow.focus();
      iframeEl.contentWindow.print();
    }
  }

  // 外部からの参照にバインド
  $effect(() => {
    if (refPrint) {
      refPrint.print = printSlides;
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      printSlides();
    }
  }

  function handleScroll() {
    if (!iframeEl || !viewerContainerEl || !isIframeLoaded) return;
    const iframeDoc = iframeEl.contentDocument;
    if (!iframeDoc) return;

    const pages = iframeDoc.querySelectorAll(".page");
    let detectedPage = 1;
    const currentZoom = viewerState.currentZoom;

    pages.forEach((page, i) => {
      if (
        viewerContainerEl!.scrollTop >=
        (page as HTMLElement).offsetTop * currentZoom - 100
      ) {
        detectedPage = i + 1;
      }
    });

    if (viewerState.currentPage !== detectedPage) {
      viewerState.currentPage = detectedPage;

      if (viewerState.presenterWindow) {
        viewerState.presenterWindow.postMessage(
          { type: "sync_page", page: viewerState.currentPage },
          "*",
        );
      }
    }
  }

  // メッセージイベントハンドラ
  function handleMessage(e: MessageEvent) {
    if (!e.data) return;

    if (e.data.type === "presenter_ready") {
      if (viewerState.presenterWindow) {
        AssetProvider.resolveAssetContent("src/css/slide_root.css").then(
          (slidesCss) => {
            viewerState.presenterWindow?.postMessage(
              {
                type: "presenter_init",
                slidesHtml: viewerState.slidesHtml,
                slidesCss,
                page: viewerState.currentPage,
              },
              "*",
            );
          },
        );
      }
    } else if (e.data.type === "sync_page") {
      const pageNumber = e.data.page;
      if (viewerState.currentPage === pageNumber) return;
      viewerState.currentPage = pageNumber;
      scrollToPage(viewerState.currentPage, true);
    }
  }

  // ズーム・モードやページのリアクティブ変更
  $effect(() => {
    // 依存関係を明示
    const _mode = viewerState.currentMode;
    const _zoom = viewerState.currentZoom;
    applyZoom();
  });

  $effect(() => {
    const page = viewerState.currentPage;
    scrollToPage(page, true);
  });

  onMount(() => {
    window.addEventListener("resize", updateLayout);
    window.addEventListener("message", handleMessage);
    window.addEventListener("keydown", handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener("resize", updateLayout);
    window.removeEventListener("message", handleMessage);
    window.removeEventListener("keydown", handleKeyDown);
  });
</script>

<div id="viewer-container" bind:this={viewerContainerEl} onscroll={handleScroll}>
  <div id="slides-scale-wrapper" bind:this={wrapperEl}>
    <iframe
      bind:this={iframeEl}
      onload={handleIframeLoad}
      srcdoc={srcdoc}
      style="width: 100%; height: 100%; border: none; overflow: hidden"
      scrolling="no"
      title="slide-viewer"
    ></iframe>
  </div>
</div>
