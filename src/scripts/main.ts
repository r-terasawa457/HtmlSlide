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

interface DroppedFile {
  relativePath: string;
  file: File;
}

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

let globalCurrentPage = 1;
let globalTotalPages = 0;
let currentMarkdownText = "";
let presenterWindow: Window | null = null;

/**
 * FileSystemEntryを再帰的に走査し、階層パス情報を持ったFileオブジェクトのフラットな配列を収集する
 * file://環境下でブラウザのエンコードバグが発生した場合は明示的に例外を外へ投げる
 */
async function collectFilesViaEntries(
  entry: FileSystemEntry,
  currentPath = "",
): Promise<DroppedFile[]> {
  const results: DroppedFile[] = [];

  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => {
      fileEntry.file(
        (f) => resolve(f),
        (err) => reject(err),
      );
    });

    const relativePath = currentPath
      ? `${currentPath}/${file.name}`
      : file.name;
    results.push({ relativePath, file });
  } else if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const dirReader = dirEntry.createReader();

    const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      dirReader.readEntries(
        (res) => resolve(res),
        (err) => reject(err),
      );
    });

    const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    for (const childEntry of entries) {
      const childFiles = await collectFilesViaEntries(childEntry, newPath);
      results.push(...childFiles);
    }
  }

  return results;
}

async function init(): Promise<void> {
  setupDragAndDrop();
}

/**
 * ビューアーおよびプレゼンターの内部 iframe 用 srcdoc 生成関数
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

    const items = e.dataTransfer?.items;
    const rawFiles = e.dataTransfer?.files;
    if (!rawFiles) return;

    let droppedFiles: DroppedFile[] = [];
    let isFallbackMode = false;

    if (items && items.length > 0) {
      try {
        for (const item of Array.from(items)) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            const files = await collectFilesViaEntries(entry);
            droppedFiles.push(...files);
          }
        }
      } catch (err) {
        isFallbackMode = true;
      }
    } else {
      isFallbackMode = true;
    }

    if (isFallbackMode) {
      for (const file of Array.from(rawFiles)) {
        const relativePath = file.webkitRelativePath || file.name;
        droppedFiles.push({ relativePath, file });
      }
    }

    try {
      const assetsMap: Record<string, string> = {};
      const duplicateFiles: string[] = [];
      let mdContent = "";
      let mdTitle = "";

      for (const dropped of droppedFiles) {
        const { relativePath, file } = dropped;
        const key = relativePath.toLowerCase();

        if (file.name.endsWith(".md")) {
          if (mdContent) {
            duplicateFiles.push(relativePath);
          } else {
            mdContent = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
            });
            mdTitle = file.name;
          }
        } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(file.name)) {
          if (assetsMap[key]) {
            duplicateFiles.push(relativePath);
          } else {
            assetsMap[key] = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reject.error);
              reader.readAsDataURL(file);
            });
          }
        }
      }

      if (duplicateFiles.length > 0) {
        alert(
          `以下のファイル名または相対パスが重複しているため、処理を中断しました:\n${duplicateFiles.join("\n")}`,
        );
        return;
      }

      if (!mdContent) {
        if (isFallbackMode && rawFiles.length === 1 && rawFiles[0].size === 0) {
          alert(
            "【ブラウザの制限による通知】\nお使いのブラウザのセキュリティ制限（file://プロトコルにおける日本語パス制限）により、フォルダ構造の直接解析に失敗しました。\n\nお手数ですが、フォルダを開いて中身のファイル群をすべて選択（Ctrl + A）し、それらをまとめてドロップしてください。",
          );
        } else {
          alert(
            "Markdownファイル(.md)が見つかりません。ファイルまたはフォルダ内のファイルをすべて選択してドロップしてください。",
          );
        }
        return;
      }

      currentMarkdownText = mdContent;
      dropZone.style.display = "none";

      const result = SlidesEngine.run(
        currentMarkdownText,
        assetsMap,
      ) as SlidesResult;
      if (result.title) {
        document.title = result.title;
      } else {
        document.title = mdTitle;
      }

      setupViewer(result.html);
    } catch (err) {
      console.error("ファイルのパースに失敗しました:", err);
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

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
