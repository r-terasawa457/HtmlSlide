/**
 * ============================================================
 * Dynamic Markdown Slides - Main Application Entry Point (TS)
 * ============================================================
 */
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "highlight.js/styles/vs.css";
import "../css/slides.css";
import "../css/viewer.css";
import "../css/present.css";

import DOMPurify from "dompurify";
import { SlidesEngine } from "./SlidesEngine";

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const bc = new BroadcastChannel("slide_sync");

const urlParams = new URLSearchParams(window.location.search);
const isPresentMode = urlParams.get("mode") === "present";

/**
 * 受け取った HTML をセキュリティ上安全にクリーン化する
 * @param html 挿入前のスライド HTML
 * @returns 安全な HTML 文字列
 */
function sanitizeSlidesHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: [
      "script",
      "iframe",
      "object",
      "embed",
      "link",
      "meta",
      "base",
      "style",
    ],
    ADD_ATTR: ["data-*", "style"],
    ALLOW_ARIA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

/**
 * スライドアプリケーションのランタイム起動
 */
async function init(): Promise<void> {
  try {
    const response = await fetch("/slides.md");
    const markdownText = await response.text();

    const result = SlidesEngine.run(markdownText);
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

/**
 * 1. ビューアー（通常管理用UI）のセットアップ
 */
function setupViewer(slidesHtml: string): void {
  const viewerUi = document.getElementById("viewer-ui");
  const presentUi = document.getElementById("present-ui");
  if (viewerUi) viewerUi.style.display = "block";
  if (presentUi) presentUi.style.display = "none";

  const wrapper = document.getElementById("slides-scale-wrapper");
  const viewer = document.getElementById("viewer-container");
  const zoomInput = document.getElementById("zoomPercent") as HTMLInputElement;
  const pageInput = document.getElementById("currentPage") as HTMLInputElement;
  const totalPagesLabel = document.getElementById("totalPages");

  if (!wrapper || !viewer || !zoomInput || !pageInput || !totalPagesLabel)
    return;

  wrapper.innerHTML = sanitizeSlidesHtml(slidesHtml);
  totalPagesLabel.textContent = String(
    document.querySelectorAll(".slide").length,
  );

  let currentZoom = 1.0;
  let currentMode: "ORIGINAL" | "CUSTOM" | "FIT_HEIGHT" | "FIT_WIDTH" =
    "FIT_HEIGHT";

  function updateLayout(): void {
    const vW = viewer!.clientWidth;
    const vH = viewer!.clientHeight;

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
    const slidesEl = wrapper!.querySelector(".slides") as HTMLElement;
    if (!slidesEl) return;

    slidesEl.style.transformOrigin = "top left";
    slidesEl.style.transform = `scale(${currentZoom})`;
    slidesEl.style.width = BASE_WIDTH + "px";

    const unscaledHeight = slidesEl.scrollHeight;
    wrapper!.style.width = BASE_WIDTH * currentZoom + "px";
    wrapper!.style.height = unscaledHeight * currentZoom + "px";
    wrapper!.style.margin = "0 auto";

    zoomInput.value = Math.round(currentZoom * 100) + "%";

    ["Original", "Custom", "FitHeight", "FitWidth"].forEach((m) => {
      const btn = document.getElementById("btn" + m);
      if (btn) {
        const targetMode = m.toUpperCase().replace("FIT", "FIT_");
        btn.classList.toggle("active", currentMode === targetMode);
      }
    });
  }

  const printSlides = (): void => window.print();

  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      printSlides();
    }
  });

  const printBtn = document.getElementById("printBtn");
  const btnOriginal = document.getElementById("btnOriginal");
  const btnCustom = document.getElementById("btnCustom");
  const btnFitHeight = document.getElementById("btnFitHeight");
  const btnFitWidth = document.getElementById("btnFitWidth");
  const zoomIn = document.getElementById("zoomIn");
  const zoomOut = document.getElementById("zoomOut");
  const presentBtn = document.getElementById("presentBtn");

  if (printBtn) printBtn.onclick = printSlides;
  if (btnOriginal)
    btnOriginal.onclick = () => {
      currentMode = "ORIGINAL";
      updateLayout();
    };
  if (btnCustom)
    btnCustom.onclick = () => {
      currentMode = "CUSTOM";
      updateLayout();
    };
  if (btnFitHeight)
    btnFitHeight.onclick = () => {
      currentMode = "FIT_HEIGHT";
      updateLayout();
    };
  if (btnFitWidth)
    btnFitWidth.onclick = () => {
      currentMode = "FIT_WIDTH";
      updateLayout();
    };
  if (zoomIn)
    zoomIn.onclick = () => {
      currentMode = "CUSTOM";
      currentZoom += 0.1;
      applyZoom();
    };
  if (zoomOut)
    zoomOut.onclick = () => {
      currentMode = "CUSTOM";
      currentZoom = Math.max(0.1, currentZoom - 0.1);
      applyZoom();
    };

  window.onresize = () => {
    if (currentMode.startsWith("FIT")) updateLayout();
  };

  pageInput.onchange = (e: Event) => {
    const targetValue = (e.target as HTMLInputElement).value;
    const target = document.getElementById("slide-" + targetValue);
    if (target)
      viewer!.scrollTo({
        top: target.offsetTop * currentZoom,
        behavior: "smooth",
      });
  };

  viewer.onscroll = (): void => {
    const sws = document.querySelectorAll(".slide");
    let current = 1;
    sws.forEach((sw, i) => {
      if (
        viewer!.scrollTop >=
        (sw as HTMLElement).offsetTop * currentZoom - 100
      ) {
        current = i + 1;
      }
    });
    pageInput.value = String(current);
    bc.postMessage({ type: "GOTO_PAGE", page: current });
  };

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
}

/**
 * 2. プレゼンター（プロジェクター投影用UI）のセットアップ
 */
function setupPresenter(slidesHtml: string): void {
  const viewerUi = document.getElementById("viewer-ui");
  const presentUi = document.getElementById("present-ui");
  if (viewerUi) viewerUi.style.display = "none";
  if (presentUi) presentUi.style.display = "flex";

  const container = document.getElementById("present-container");
  const fullscreenHint = document.getElementById("fullscreen-hint");
  if (!container) return;

  container.innerHTML = sanitizeSlidesHtml(slidesHtml);

  function updateLayout(): void {
    const scale = Math.min(
      window.innerWidth / BASE_WIDTH,
      window.innerHeight / BASE_HEIGHT,
    );
    container!.style.transform = `scale(${scale})`;
  }

  bc.onmessage = (e: MessageEvent) => {
    if (e.data.type === "GOTO_PAGE") {
      const target = container!.querySelector(
        "#slide-" + e.data.page,
      ) as HTMLElement;
      if (target) {
        container!.scrollTo({ top: target.offsetTop, behavior: "smooth" });
      }
    }
  };

  window.onresize = updateLayout;
  if (fullscreenHint) {
    fullscreenHint.onclick = () => {
      document.documentElement.requestFullscreen();
    };
  }

  updateLayout();
}

document.addEventListener("DOMContentLoaded", init);
