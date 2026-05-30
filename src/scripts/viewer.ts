const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

let globalCurrentPage = 1;
let globalTotalPages = 0;
let presenterWindow: Window | null = null;

const slidesCss = "__SLIDES_CSS_PLACEHOLDER__";

/**
 * ビューアーおよびプレゼンターの内部 iframe 用 srcdoc 生成関数
 */
(window as any).createSrcDoc = function createSrcDoc(
  slidesHtml: string,
): string {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.port !== "";

  const cssContent = isDev
    ? `<link rel="stylesheet" href="/src/css/slides.css" />`
    : `<style>${slidesCss}</style>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
  </style>
  ${cssContent}
</head>
<body>
  ${slidesHtml}
</body>
</html>`;
};

export function setupViewer(slidesHtml: string): void {
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
          (window as any).currentSlidesHtml = slidesHtml;
          (window as any).globalCurrentPage = globalCurrentPage;

          const embeddedData = "__PRESENTER_DATA_PLACEHOLDER__";
          let presenterHtmlContent = "";

          if (embeddedData.startsWith("DEV_HTML:")) {
            presenterHtmlContent = embeddedData.slice(9);
          } else {
            const binaryString = atob(embeddedData);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            presenterHtmlContent = new TextDecoder("utf-8").decode(bytes);
          }

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
