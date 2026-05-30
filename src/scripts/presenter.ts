/**
 * 💡 プレゼンターウィンドウ内部のネイティブコンテキストで実行される独立スクリプト
 */

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
let globalCurrentPage = 1;
let globalTotalPages = 0;

// 親ウィンドウ（window.opener）のカスタム関数・変数にアクセスするための型定義
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

  // 親ウィンドウが保持している共通のデータ・関数資産を安全に引き継ぐ
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

  // 親ウィンドウ（main.js）から、このポップアップの関数を直接メモリ上で叩けるようにグローバル露出させる
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

    // 親（ビューアー）の共通受け口関数を直接実行して同期（逆同期）
    if (openerWin && openerWin.syncViewerFromPresenter) {
      openerWin.syncViewerFromPresenter(globalCurrentPage);
    }
  }

  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    globalTotalPages = iframeDoc.querySelectorAll(".page").length;

    // 親ウィンドウ側の現在の閲覧ページに初期位置をジャストフィットさせる
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

    // ポップアップのウィンドウ全体、およびスライド実体(iframe)の双方にキー入力をバインド
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
