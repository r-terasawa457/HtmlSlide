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

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

let globalCurrentPage = 1;
let globalTotalPages = 0;
let currentMarkdownText = "";
let presenterWindow: Window | null = null;

async function init(): Promise<void> {
  setupDragAndDrop();
}

/**
 * ビューアーおよびプレゼンターのiframe用srcdocを生成（グローバルに公開）
 */
(window as any).createSrcDoc = function createSrcDoc(
  slidesHtml: string,
): string {
  const parentStyles = Array.from(document.querySelectorAll("style"))
    .map((style) => style.textContent || "")
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
    ${parentStyles}
    ${slidesCss}
  </style>
</head>
<body>
  ${slidesHtml}
</body>
</html>`;
};

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

  iframe.srcdoc = (window as any).createSrcDoc(slidesHtml);

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

    // 子（プレゼンター）ウィンドウ側から直接叩かれる逆同期共通口
    (window as any).syncViewerFromPresenter = (pageNumber: number) => {
      if (globalCurrentPage === pageNumber) return;
      globalCurrentPage = pageNumber;
      pageInput.value = globalCurrentPage.toString();
      scrollToPage(globalCurrentPage, true);
    };

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

      if (presenterWindow && (presenterWindow as any).syncPresenterScroll) {
        (presenterWindow as any).syncPresenterScroll(globalCurrentPage);
      }
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

        if (presenterWindow && (presenterWindow as any).syncPresenterScroll) {
          (presenterWindow as any).syncPresenterScroll(globalCurrentPage);
        }
      }
    };

    const presentBtn = document.getElementById("presentBtn");
    if (presentBtn) {
      presentBtn.onclick = () => {
        presenterWindow = window.open(
          "",
          "presWin",
          `width=${BASE_WIDTH},height=${BASE_HEIGHT},menubar=no,toolbar=no,location=no,status=no`,
        );

        if (presenterWindow) {
          // 💡 複雑な箇所への補足:
          // 子ウィンドウが親を参照・ロードできるようにメモリ空間にブリッジデータを一時退避
          (window as any).currentSlidesHtml = slidesHtml;
          (window as any).globalCurrentPage = globalCurrentPage;

          // 💡 複雑な箇所への補足:
          // build.js によって、コンパイル後の「スクリプト内包型 presenter.html」文字列がここに完全インジェクションされます
          const presenterHtmlContent = `__PRESENTER_HTML_STRING__`;

          // 空のウィンドウ空間に本物のHTML・JSドキュメントをパースさせてネイティブ起動
          presenterWindow.document.open();
          presenterWindow.document.write(presenterHtmlContent);
          presenterWindow.document.close();
        }
      };
    }

    updateLayout();
    window.dispatchEvent(new Event("resize"));
  };
}

document.addEventListener("DOMContentLoaded", init);
