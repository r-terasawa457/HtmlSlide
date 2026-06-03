const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
let globalCurrentPage = 1;
let globalTotalPages = 0;

function createSrcDoc(slidesHtml: string, slidesCss: string): string {
  const isDev =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.port !== "";

  const cssContent = isDev
    ? `<link rel="stylesheet" href="/src/css/slide_root.css" />`
    : `<style>${slidesCss}</style>`;

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

function initPresenter(): void {
  const iframe = document.getElementById(
    "present-iframe",
  ) as HTMLIFrameElement | null;
  const container = document.getElementById(
    "present-container",
  ) as HTMLElement | null;

  if (!iframe || !container || !window.opener) return;

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

  function changePageRelative(offset: number): void {
    const targetPage = globalCurrentPage + offset;
    if (targetPage < 1 || targetPage > globalTotalPages) return;

    globalCurrentPage = targetPage;
    navigateToPage(globalCurrentPage, true);

    window.opener.postMessage(
      { type: "sync_page", page: globalCurrentPage },
      "*",
    );
  }

  // 親からデータ（slidesHtml, slidesCss）を受け取った時にスライドを構築
  window.addEventListener("message", (e) => {
    if (!e.data) return;

    if (e.data.type === "presenter_init") {
      const { slidesHtml, slidesCss, page } = e.data;
      iframe.srcdoc = createSrcDoc(slidesHtml, slidesCss);

      iframe.onload = () => {
        const iframeDoc = iframe.contentDocument;
        if (!iframeDoc) return;

        globalTotalPages = iframeDoc.querySelectorAll(".page").length;
        globalCurrentPage = page || 1;
        navigateToPage(globalCurrentPage, false);

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
          iframe.contentWindow.addEventListener(
            "keydown",
            handlePresenterKeyDown,
          );
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
    } else if (e.data.type === "sync_page") {
      const pageNumber = e.data.page;
      if (globalCurrentPage === pageNumber) return;
      globalCurrentPage = pageNumber;
      navigateToPage(globalCurrentPage, true);
    }
  });

  // 準備完了したことを親ウィンドウに通知
  window.opener.postMessage({ type: "presenter_ready" }, "*");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPresenter);
} else {
  initPresenter();
}
