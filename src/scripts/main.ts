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

interface SyncMessage {
  type: "GOTO_PAGE";
  page: number;
}

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const bc = new BroadcastChannel("slide_sync");

const urlParams = new URLSearchParams(window.location.search);
const isPresentMode = urlParams.get("mode") === "present";

async function init(): Promise<void> {
  try {
    const response = await fetch("/slides.md");
    const markdownText = await response.text();

    const result = SlidesEngine.run(markdownText) as SlidesResult;
    if (result.title) document.title = result.title;

    if (isPresentMode) {
      document.body.classList.add("present-mode");
      setupPresenter(result.html);
    } else {
      document.body.classList.add("viewer-mode");
      setupViewer(result.html);
    }
  } catch (err) {
    console.error("スライドシステムの初期化に失敗しました:", err);
  }
}

function createSrcDoc(slidesHtml: string): string {
  return `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8" /><link rel="stylesheet" href="/dist/main.css" /><style>body{margin:0;padding:0;background:transparent;overflow:hidden;}${slidesCss}@media print{body{overflow:visible!important;}.slides{transform:none!important;width:${BASE_WIDTH}px!important;height:auto!important;}.page{page-break-after:always;page-break-inside:avoid;}}</style></head><body>${slidesHtml}</body></html>`;
}

function setupViewer(slidesHtml: string): void {
  const viewerUi = document.getElementById("viewer-ui");
  const presentUi = document.getElementById("present-ui");
  if (viewerUi) viewerUi.style.display = "block";
  if (presentUi) presentUi.style.display = "none";

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
    totalPagesLabel.textContent = pages.length.toString();

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
      const targetVal = (e.target as HTMLInputElement).value;
      const target = iframeDoc.getElementById("slide-" + targetVal);
      if (target && viewer) {
        viewer.scrollTo({
          top: target.offsetTop * currentZoom,
          behavior: "smooth",
        });
      }
    };

    viewer.onscroll = () => {
      const sws = iframeDoc.querySelectorAll(".page");
      let current = 1;
      sws.forEach((sw, i) => {
        if (
          viewer.scrollTop >=
          (sw as HTMLElement).offsetTop * currentZoom - 100
        ) {
          current = i + 1;
        }
      });
      pageInput.value = current.toString();

      const message: SyncMessage = { type: "GOTO_PAGE", page: current };
      bc.postMessage(message);
    };

    const presentBtn = document.getElementById("presentBtn");
    if (presentBtn) {
      presentBtn.onclick = () => {
        window.open(
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

function setupPresenter(slidesHtml: string): void {
  const viewerUi = document.getElementById("viewer-ui");
  const presentUi = document.getElementById("present-ui");
  if (viewerUi) viewerUi.style.display = "none";
  if (presentUi) presentUi.style.display = "flex";

  const iframe = document.getElementById(
    "present-iframe",
  ) as HTMLIFrameElement | null;
  const container = document.getElementById("present-container");

  if (!iframe || !container) return;

  iframe.srcdoc = createSrcDoc(slidesHtml);

  iframe.onload = () => {
    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) return;

    function updateLayout(): void {
      const scale = Math.min(
        window.innerWidth / BASE_WIDTH,
        window.innerHeight / BASE_HEIGHT,
      );
      if (container) container.style.transform = `scale(${scale})`;
    }

    bc.onmessage = (e: MessageEvent) => {
      const data = e.data as SyncMessage;
      if (data.type === "GOTO_PAGE") {
        const target = iframeDoc!.querySelector(
          "#slide-" + data.page,
        ) as HTMLElement | null;
        if (target && iframe.contentWindow) {
          iframe.contentWindow.scrollTo({
            top: target.offsetTop,
            behavior: "smooth",
          });
        }
      }
    };

    window.onresize = updateLayout;

    const hint = document.getElementById("fullscreen-hint");
    if (hint) {
      hint.onclick = () => {
        document.documentElement.requestFullscreen();
      };
    }

    updateLayout();
  };
}

document.addEventListener("DOMContentLoaded", init);
