import { AssetProvider } from "./AssetProvider";

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

let globalCurrentPage = 1;
let globalTotalPages = 0;
let presenterWindow: Window | null = null;

/**
 * ビューアーおよびプレゼンターの内部 iframe 用 srcdoc 生成関数
 */
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

export async function setupViewer(slidesHtml: string): Promise<void> {
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

  iframe.srcdoc = await createSrcDoc(slidesHtml);

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

    // メッセージ通信によるプレゼンターとの同期処理
    window.addEventListener("message", async (e) => {
      if (!e.data) return;
      if (e.data.type === "presenter_ready") {
        if (presenterWindow) {
          const slidesCss = await AssetProvider.resolveAssetContent(
            "src/css/slide_root.css",
          );
          presenterWindow.postMessage(
            {
              type: "presenter_init",
              slidesHtml,
              slidesCss,
              page: globalCurrentPage,
            },
            "*",
          );
        }
      } else if (e.data.type === "sync_page") {
        const pageNumber = e.data.page;
        if (globalCurrentPage === pageNumber) return;
        globalCurrentPage = pageNumber;
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

      if (presenterWindow) {
        presenterWindow.postMessage(
          { type: "sync_page", page: globalCurrentPage },
          "*",
        );
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

        if (presenterWindow) {
          presenterWindow.postMessage(
            { type: "sync_page", page: globalCurrentPage },
            "*",
          );
        }
      }
    };

    const pptxBtn = document.getElementById(
      "pptxBtn",
    ) as HTMLButtonElement | null;
    if (pptxBtn) {
      pptxBtn.onclick = async () => {
        const title = document.title || "presentation";
        const fileName = `${title}.pptx`;

        pptxBtn.disabled = true;
        pptxBtn.title = "PPTX生成中...";

        // 一時的なエクスポート用iframeを画面外に作成
        const exportIframe = document.createElement("iframe");
        exportIframe.style.position = "absolute";
        exportIframe.style.left = "-9999px";
        exportIframe.style.top = "-9999px";
        exportIframe.style.width = "1280px";
        exportIframe.style.height = "720px";
        exportIframe.style.border = "none";

        const cleanup = () => {
          if (document.body.contains(exportIframe)) {
            document.body.removeChild(exportIframe);
          }
          delete (window as any).onPptxExportComplete;
          delete (window as any).onPptxExportError;
          pptxBtn.disabled = false;
          pptxBtn.title = "pptxに出力";
        };

        (window as any).onPptxExportComplete = () => {
          cleanup();
          alert("PPTXのエクスポートが完了しました。");
        };

        (window as any).onPptxExportError = (msg: string) => {
          cleanup();
          alert(`PPTXのエクスポートに失敗しました:\n${msg}`);
        };

        const pptxExportTemplate =
          await AssetProvider.resolveAssetContent("pptx_export.html");
        const pptxExportScript =
          await AssetProvider.resolveScriptTag("dist/pptxExport.js");
        const pptxExportHtml = pptxExportTemplate.replace(
          "<!-- EXPORT_SCRIPT_TAG -->",
          () => pptxExportScript,
        );
        exportIframe.srcdoc = pptxExportHtml;

        exportIframe.onload = async () => {
          const exportWin = exportIframe.contentWindow as any;
          if (exportWin && exportWin.startExport) {
            const slidesCss = await AssetProvider.resolveAssetContent(
              "src/css/slide_root.css",
            );
            exportWin.startExport({
              slidesHtml,
              slidesCss,
              fileName,
            });
          } else {
            (window as any).onPptxExportError(
              "エクスポートモジュールの読み込みに失敗しました。",
            );
          }
        };

        document.body.appendChild(exportIframe);
      };
    }

    const presentBtn = document.getElementById("presentBtn");
    if (presentBtn) {
      presentBtn.onclick = async () => {
        const presenterUrl =
          await AssetProvider.resolveCompositeHtmlUrl("src/presenter.html");

        presenterWindow = window.open(
          presenterUrl,
          "presWin",
          `width=${BASE_WIDTH},height=${BASE_HEIGHT},menubar=no,toolbar=no,location=no,status=no`,
        );
      };
    }

    updateLayout();
    window.dispatchEvent(new Event("resize"));
  };
}
