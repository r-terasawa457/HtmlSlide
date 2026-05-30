import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "highlight.js/styles/vs.css";
import "../css/viewer.css";
import "../css/present.css";

import slidesCss from "../css/slides.css" with { type: "text" };
import { SlidesEngine } from "./SlidesEngine.ts";

interface SlidesResult {
  title?: string;
  html: string;
}

type SyncMessage =
  | { type: "REQUEST_DATA" }
  | { type: "SEND_DATA"; markdown: string }
  | { type: "GOTO_PAGE"; page: number };

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

const urlParams = new URLSearchParams(window.location.search);
const isPresentMode = urlParams.get("mode") === "present";

// ウィンドウを跨いで共有・同期される現在のページ番号（無限ループ防止の判定に使用）
let globalCurrentPage = 1;
let globalTotalPages = 0;
let currentMarkdownText = "";
let presenterWindow: Window | null = null;

async function init(): Promise<void> {
  if (isPresentMode) {
    document.body.classList.add("present-mode");
    const dropZone = document.getElementById("drop-zone");
    if (dropZone) dropZone.style.display = "none";
    setupPresenter();
  } else {
    document.body.classList.add("viewer-mode");
    setupDragAndDrop();
  }
}

/**
 * file://環境下で安全にメッセージを通信相手（ウィンドウ参照）へ送信するヘルパー
 */
function sendPostMessage(target: Window | null, message: SyncMessage): void {
  if (target) {
    target.postMessage(message, "*");
  }
}

function createSrcDoc(slidesHtml: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8" /><link rel="stylesheet" href="/dist/main.css" /><style>body{margin:0;padding:0;background:transparent;overflow:hidden;}${slidesCss}@media print{body{overflow:visible!important;}.slides{transform:none!important;width:${BASE_WIDTH}px!important;height:auto!important;}.page{page-break-after:always;page-break-inside:avoid;}}</style></head><body>${slidesHtml}</body></html>`;
}

/**
 * ビューアーモード専用：ドラッグ＆ドロップハンドラーの設定
 */
function setupDragAndDrop(): void {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => e.preventDefault());

  dropZone.addEventListener("dragover", () =>
    dropZone.classList.add("dragover"),
  );
  dropZone.addEventListener("dragleave", () =>
    dropZone.classList.remove("dragover"),
  );

  dropZone.addEventListener("drop", async (e: DragEvent) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");

    const file = e.dataTransfer?.files[0];
    if (!file || !file.name.endsWith(".md")) {
      alert("Markdownファイル(.md)をドロップしてください。");
      return;
    }

    try {
      currentMarkdownText = await file.text();
      dropZone.style.display = "none";

      const result = SlidesEngine.run(currentMarkdownText) as SlidesResult;
      if (result.title) document.title = result.title;

      setupViewer(result.html);
    } catch (err) {
      console.error("ファイルの読み込みに失敗しました:", err);
      alert("ファイルの解析に失敗しました。");
    }
  });
}

/**
 * ビューアー（親画面）の制御ロジック
 */
function setupViewer(slidesHtml: string): void {
  const viewerUi = document.getElementById("viewer-ui");
  if (viewerUi) viewerUi.style.display = "block";

  const iframe = document.getElementById(
    "viewer-iframe",
  ) as HTMLIFrameElement | null;
  const wrapper = document.getElementById("slides-scale-wrapper");
  const viewer = document.getElementById("viewer-container");
  const zoomInput = document.getElementById(
    "zoomPercent",
  ) as HTMLInputElement | null;
  const pageInput = document.getElementById(
    "currentPage",
  ) as HTMLInputElement | null;
  const totalPagesLabel = document.getElementById("totalPages");

  if (
    !iframe ||
    !wrapper ||
    !viewer ||
    !zoomInput ||
    !pageInput ||
    !totalPagesLabel
  )
    return;

  iframe.srcdoc = createSrcDoc(slidesHtml);

  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    const pages = iframeDoc.querySelectorAll(".page");
    globalTotalPages = pages.length;
    totalPagesLabel.textContent = globalTotalPages.toString();

    let currentZoom = 1.0;
    let currentMode: "ORIGINAL" | "CUSTOM" | "FIT_HEIGHT" | "FIT_WIDTH" =
      "FIT_HEIGHT";

    function updateLayout(): void {
      if (!viewer) return;
      const vW = viewer.clientWidth;
      const vH = viewer.clientHeight;

      if (currentMode === "ORIGINAL") currentZoom = 1.0;
      else if (currentMode === "FIT_WIDTH") currentZoom = vW / BASE_WIDTH;
      else if (currentMode === "FIT_HEIGHT") {
        let scale = vH / BASE_HEIGHT;
        if (BASE_WIDTH * scale > vW) scale = vW / BASE_WIDTH;
        currentZoom = scale;
      }
      applyZoom();
    }

    function applyZoom(): void {
      const slidesEl = iframeDoc!.querySelector(
        ".slides",
      ) as HTMLElement | null;
      if (!slidesEl || !wrapper || !zoomInput) return;

      slidesEl.style.transformOrigin = "top left";
      slidesEl.style.transform = `scale(${currentZoom})`;
      slidesEl.style.width = `${BASE_WIDTH}px`;

      const unscaledHeight = slidesEl.scrollHeight;
      wrapper.style.width = `${BASE_WIDTH * currentZoom}px`;
      wrapper.style.height = `${unscaledHeight * currentZoom}px`;
      wrapper.style.margin = "0 auto";

      zoomInput.value = Math.round(currentZoom * 100) + "%";

      ["Original", "Custom", "FitHeight", "FitWidth"].forEach((m) => {
        const btn = document.getElementById("btn" + m);
        if (btn) {
          const modeKey = m.toUpperCase().replace("FIT", "FIT_");
          btn.classList.toggle("active", currentMode === modeKey);
        }
      });
    }

    function scrollToPage(pageNumber: number, smooth = true): void {
      const target = iframeDoc!.getElementById("slide-" + pageNumber);
      if (target && viewer) {
        viewer.scrollTo({
          top: target.offsetTop * currentZoom,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    }

    // プレゼンター（子）および入力欄からの変更を受け付けるイベントリスナー
    window.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as SyncMessage;
      if (!data) return;

      if (data.type === "REQUEST_DATA" && presenterWindow) {
        sendPostMessage(presenterWindow, {
          type: "SEND_DATA",
          markdown: currentMarkdownText,
        });
        sendPostMessage(presenterWindow, {
          type: "GOTO_PAGE",
          page: globalCurrentPage,
        });
      }

      if (data.type === "GOTO_PAGE") {
        if (globalCurrentPage === data.page) return; // すでに同一ページなら処理をスキップ（無限ループ防止）
        globalCurrentPage = data.page;
        pageInput.value = globalCurrentPage.toString();
        scrollToPage(globalCurrentPage, true);
      }
    });

    const printSlides = (): void => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        printSlides();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    if (iframe.contentWindow) {
      iframe.contentWindow.addEventListener("keydown", handleKeyDown);
    }

    const printBtn = document.getElementById("printBtn");
    if (printBtn) printBtn.onclick = printSlides;

    const bindClick = (id: string, mode: typeof currentMode) => {
      const btn = document.getElementById(id);
      if (btn)
        btn.onclick = () => {
          currentMode = mode;
          updateLayout();
        };
    };

    bindClick("btnOriginal", "ORIGINAL");
    bindClick("btnCustom", "CUSTOM");
    bindClick("btnFitHeight", "FIT_HEIGHT");
    bindClick("btnFitWidth", "FIT_WIDTH");

    const zoomInBtn = document.getElementById("zoomIn");
    if (zoomInBtn) {
      zoomInBtn.onclick = () => {
        currentMode = "CUSTOM";
        currentZoom += 0.1;
        applyZoom();
      };
    }

    const zoomOutBtn = document.getElementById("zoomOut");
    if (zoomOutBtn) {
      zoomOutBtn.onclick = () => {
        currentMode = "CUSTOM";
        currentZoom = Math.max(0.1, currentZoom - 0.1);
        applyZoom();
      };
    }

    window.onresize = () => {
      if (currentMode.startsWith("FIT")) updateLayout();
    };

    pageInput.onchange = (e: Event) => {
      const targetVal = parseInt((e.target as HTMLInputElement).value, 10);
      if (isNaN(targetVal) || targetVal < 1 || targetVal > globalTotalPages)
        return;

      globalCurrentPage = targetVal;
      scrollToPage(globalCurrentPage, true);
      sendPostMessage(presenterWindow, {
        type: "GOTO_PAGE",
        page: globalCurrentPage,
      });
    };

    viewer.onscroll = () => {
      const sws = iframeDoc.querySelectorAll(".page");
      let detectedPage = 1;
      sws.forEach((sw, i) => {
        if (
          viewer.scrollTop >=
          (sw as HTMLElement).offsetTop * currentZoom - 100
        ) {
          detectedPage = i + 1;
        }
      });

      if (globalCurrentPage !== detectedPage) {
        globalCurrentPage = detectedPage;
        pageInput.value = globalCurrentPage.toString();
        // プレゼンター側ウィンドウへ通知
        sendPostMessage(presenterWindow, {
          type: "GOTO_PAGE",
          page: globalCurrentPage,
        });
      }
    };

    const presentBtn = document.getElementById("presentBtn");
    if (presentBtn) {
      presentBtn.onclick = () => {
        presenterWindow = window.open(
          "index.html?mode=present",
          "presWin",
          `width=${BASE_WIDTH},height=${BASE_HEIGHT},menubar=no,toolbar=no,location=no,status=no`,
        );
      };
    }

    updateLayout();
    window.dispatchEvent(new Event("resize"));
  };
}

/**
 * プレゼンター（子画面）の制御ロジック
 */
function setupPresenter(): void {
  const viewerUi = document.getElementById("viewer-ui");
  const presentUi = document.getElementById("present-ui");
  if (viewerUi) viewerUi.style.display = "none";
  if (presentUi) presentUi.style.display = "flex";

  const iframe = document.getElementById(
    "present-iframe",
  ) as HTMLIFrameElement | null;
  const container = document.getElementById("present-container");

  if (!iframe || !container) return;

  // 親ウィンドウへデータ要求を送信
  if (window.opener) {
    sendPostMessage(window.opener, { type: "REQUEST_DATA" });
  }

  window.addEventListener("message", (e: MessageEvent) => {
    const data = e.data as SyncMessage;
    if (!data) return;

    if (data.type === "SEND_DATA") {
      const result = SlidesEngine.run(data.markdown) as SlidesResult;
      iframe.srcdoc = createSrcDoc(result.html);
    }

    if (data.type === "GOTO_PAGE") {
      if (globalCurrentPage === data.page) return; // すでに同一ページなら何もしない
      globalCurrentPage = data.page;
      navigateToPage(globalCurrentPage, true);
    }
  });

  function updateLayout(): void {
    const scale = Math.min(
      window.innerWidth / BASE_WIDTH,
      window.innerHeight / BASE_HEIGHT,
    );
    if (container) container.style.transform = `scale(${scale})`;
  }

  function navigateToPage(pageNumber: number, smooth = true): void {
    const iframeDoc = iframe!.contentDocument;
    if (!iframeDoc) return;

    const target = iframeDoc.querySelector(
      "#slide-" + pageNumber,
    ) as HTMLElement | null;
    if (target && iframe!.contentWindow) {
      iframe!.contentWindow.scrollTo({
        top: target.offsetTop,
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }

  // プレゼンター側でのページ送り制御（次へ・前へ）
  function changePageRelative(offset: number): void {
    const targetPage = globalCurrentPage + offset;
    if (targetPage < 1 || targetPage > globalTotalPages) return;

    globalCurrentPage = targetPage;
    navigateToPage(globalCurrentPage, true);

    // 親（ビューアー）へ変更通知を送信
    if (window.opener) {
      sendPostMessage(window.opener, {
        type: "GOTO_PAGE",
        page: globalCurrentPage,
      });
    }
  }

  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    globalTotalPages = iframeDoc.querySelectorAll(".page").length;

    // プレゼンター側でのキーボード操作イベントハンドラ
    const handlePresenterKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "Space":
        case "PageDown":
        case "Enter":
          e.preventDefault();
          changePageRelative(1);
          break;
        case "ArrowLeft":
        case "Backspace":
        case "PageUp":
          e.preventDefault();
          changePageRelative(-1);
          break;
      }
    };

    // 親ウィンドウ・iframe内部の双方でキー入力を受け付けるようバインド
    window.addEventListener("keydown", handlePresenterKeyDown);
    if (iframe.contentWindow) {
      iframe.contentWindow.addEventListener("keydown", handlePresenterKeyDown);
    }

    window.onresize = updateLayout;

    const hint = document.getElementById("fullscreen-hint");
    if (hint) {
      hint.onclick = () => {
        document.documentElement.requestFullscreen().catch(console.error);
      };
    }

    updateLayout();
  };
}

document.addEventListener("DOMContentLoaded", init);
