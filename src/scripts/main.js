import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "highlight.js/styles/vs.css";
import "../css/slides.css";
import "../css/viewer.css";
import "../css/present.css";

import { SlidesEngine } from "./SlidesEngine.ts";

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;
const bc = new BroadcastChannel("slide_sync");

const urlParams = new URLSearchParams(window.location.search);
const isPresentMode = urlParams.get("mode") === "present";

/**
 * アプリケーションの初期化
 */
async function init() {
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
 * ==========================================
 * 1. ビューアーモードのセットアップ
 * ==========================================
 */
function setupViewer(slidesHtml) {
  // 💡 【最重要修正】ビューアーUIを表示し、プレゼンUIを完全に消し去る
  document.getElementById("viewer-ui").style.display = "block";
  document.getElementById("present-ui").style.display = "none";

  const wrapper = document.getElementById("slides-scale-wrapper");
  const viewer = document.getElementById("viewer-container");
  const zoomInput = document.getElementById("zoomPercent");
  const pageInput = document.getElementById("currentPage");
  const totalPagesLabel = document.getElementById("totalPages");

  wrapper.innerHTML = slidesHtml;
  totalPagesLabel.textContent = document.querySelectorAll(".page").length;

  let currentZoom = 1.0;
  let currentMode = "FIT_HEIGHT";

  function updateLayout() {
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

  function applyZoom() {
    const slidesEl = wrapper.querySelector(".slides");
    if (!slidesEl) return;

    slidesEl.style.transformOrigin = "top left";
    slidesEl.style.transform = `scale(${currentZoom})`;
    slidesEl.style.width = BASE_WIDTH + "px";

    const unscaledHeight = slidesEl.scrollHeight;
    wrapper.style.width = BASE_WIDTH * currentZoom + "px";
    wrapper.style.height = unscaledHeight * currentZoom + "px";
    wrapper.style.margin = "0 auto";

    zoomInput.value = Math.round(currentZoom * 100) + "%";
    ["Original", "Custom", "FitHeight", "FitWidth"].forEach((m) => {
      const btn = document.getElementById("btn" + m);
      if (btn)
        btn.classList.toggle(
          "active",
          currentMode === m.toUpperCase().replace("FIT", "FIT_"),
        );
    });
  }

  const printSlides = () => window.print();

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "p") {
      e.preventDefault();
      printSlides();
    }
  });

  document.getElementById("printBtn").onclick = printSlides;
  document.getElementById("btnOriginal").onclick = () => {
    currentMode = "ORIGINAL";
    updateLayout();
  };
  document.getElementById("btnCustom").onclick = () => {
    currentMode = "CUSTOM";
    updateLayout();
  };
  document.getElementById("btnFitHeight").onclick = () => {
    currentMode = "FIT_HEIGHT";
    updateLayout();
  };
  document.getElementById("btnFitWidth").onclick = () => {
    currentMode = "FIT_WIDTH";
    updateLayout();
  };
  document.getElementById("zoomIn").onclick = () => {
    currentMode = "CUSTOM";
    currentZoom += 0.1;
    applyZoom();
  };
  document.getElementById("zoomOut").onclick = () => {
    currentMode = "CUSTOM";
    currentZoom = Math.max(0.1, currentZoom - 0.1);
    applyZoom();
  };

  window.onresize = () => {
    if (currentMode.startsWith("FIT")) updateLayout();
  };

  pageInput.onchange = (e) => {
    const target = document.getElementById("slide-" + e.target.value);
    if (target)
      viewer.scrollTo({
        top: target.offsetTop * currentZoom,
        behavior: "smooth",
      });
  };

  viewer.onscroll = () => {
    const sws = document.querySelectorAll(".page");
    let current = 1;
    sws.forEach((sw, i) => {
      if (viewer.scrollTop >= sw.offsetTop * currentZoom - 100) current = i + 1;
    });
    pageInput.value = current;
    bc.postMessage({ type: "GOTO_PAGE", page: current });
  };

  document.getElementById("presentBtn").onclick = () => {
    window.open(
      "index.html?mode=present",
      "presWin",
      `width=${BASE_WIDTH},height=${BASE_HEIGHT},menubar=no,toolbar=no,location=no,status=no`,
    );
  };

  updateLayout();
  window.dispatchEvent(new Event("resize"));
}

/**
 * ==========================================
 * 2. プレゼンターモードのセットアップ
 * ==========================================
 */
function setupPresenter(slidesHtml) {
  // 💡 【最重要修正】ビューアーUI（ツールバー含む）を完全に消し去り、プレゼンUIだけを表示する
  document.getElementById("viewer-ui").style.display = "none";
  document.getElementById("present-ui").style.display = "flex";

  const container = document.getElementById("present-container");
  container.innerHTML = slidesHtml;

  function updateLayout() {
    const scale = Math.min(
      window.innerWidth / BASE_WIDTH,
      window.innerHeight / BASE_HEIGHT,
    );
    container.style.transform = `scale(${scale})`;
  }

  bc.onmessage = (e) => {
    if (e.data.type === "GOTO_PAGE") {
      const target = container.querySelector("#slide-" + e.data.page);
      if (target) {
        container.scrollTo({ top: target.offsetTop, behavior: "smooth" });
      }
    }
  };

  window.onresize = updateLayout;
  document.getElementById("fullscreen-hint").onclick = () => {
    document.documentElement.requestFullscreen();
  };

  updateLayout();
}

document.addEventListener("DOMContentLoaded", init);
