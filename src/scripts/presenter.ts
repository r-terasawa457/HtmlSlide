const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
let globalCurrentPage = 1;
let globalTotalPages = 0;

interface ExtendedWindow extends Window {
  syncViewerFromPresenter?: (pageNumber: number) => void;
  createSrcDoc?: (html: string) => string;
  currentSlidesHtml?: string;
  globalCurrentPage?: number;
}

const openerWin = window.opener as ExtendedWindow | null;

function initPresenter(): void {
  const iframe = document.getElementById(
    "present-iframe",
  ) as HTMLIFrameElement | null;
  const container = document.getElementById(
    "present-container",
  ) as HTMLElement | null;

  if (!iframe || !container || !openerWin) return;

  const rawSlidesHtml = (openerWin as any).currentSlidesHtml || "";
  if (openerWin.createSrcDoc) {
    iframe.srcdoc = openerWin.createSrcDoc(rawSlidesHtml);
  }

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

  (window as any).syncPresenterScroll = (pageNumber: number) => {
    if (globalCurrentPage === pageNumber) return;
    globalCurrentPage = pageNumber;
    navigateToPage(globalCurrentPage, true);
  };

  function changePageRelative(offset: number): void {
    const targetPage = globalCurrentPage + offset;
    if (targetPage < 1 || targetPage > globalTotalPages) return;

    globalCurrentPage = targetPage;
    navigateToPage(globalCurrentPage, true);

    if (openerWin && openerWin.syncViewerFromPresenter) {
      openerWin.syncViewerFromPresenter(globalCurrentPage);
    }
  }

  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    globalTotalPages = iframeDoc.querySelectorAll(".page").length;

    if (openerWin && typeof openerWin.globalCurrentPage === "number") {
      globalCurrentPage = openerWin.globalCurrentPage;
      navigateToPage(globalCurrentPage, false);
    }

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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPresenter);
} else {
  initPresenter();
}
