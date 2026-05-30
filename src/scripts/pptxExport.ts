import { exportToPptx } from "dom-to-pptx";
import html2canvas from "html2canvas";

interface ExportData {
  slidesHtml: string;
  slidesCss: string;
  fileName: string;
}

/**
 * コードブロックを html2canvas を用いて高解像度画像に変換・置換する
 * これによりシンタックスハイライト、改行、インデント、高さを完全に再現します
 */
async function preprocessCodeBlocks(container: HTMLElement): Promise<void> {
  const preEls = Array.from(container.querySelectorAll("pre"));
  for (const pre of preEls) {
    try {
      // 元のプレビュー矩形サイズを取得
      const rect = pre.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      // html2canvasでキャプチャ
      const canvas = await html2canvas(pre, {
        backgroundColor: null,
        logging: false,
        scale: 2, // 2倍高解像度
        useCORS: true,
      });

      const imgDataUrl = canvas.toDataURL("image/png");
      const img = document.createElement("img");
      img.src = imgDataUrl;
      img.style.width = `${rect.width}px`;
      img.style.height = `${rect.height}px`;
      img.style.display = "block";
      img.style.boxSizing = "border-box";
      img.style.margin = window.getComputedStyle(pre).margin;
      img.className = pre.className;

      pre.parentNode?.replaceChild(img, pre);
    } catch (e) {
      console.error("Failed to render code block to image", e);
    }
  }
}

/**
 * MathJax(SVG) の数式をPPTX出力時に正しくサイズ計測させ、不要なMathMLテキストを削除するための前処理
 */
function preprocessMathJax(container: HTMLElement): void {
  // 1. まず非表示のMathML (mjx-assistive-mml) を完全に除去してテキストエクスポートを防ぐ
  const assistiveMmls = container.querySelectorAll("mjx-assistive-mml");
  assistiveMmls.forEach((el) => el.remove());

  // 2. SVGコンテナ要素のサイズを明示的にpx単位に置換
  const mjxContainers = container.querySelectorAll("mjx-container[jax='SVG']");
  mjxContainers.forEach((mjx) => {
    const svg = mjx.querySelector("svg");
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    if (w > 0 && h > 0) {
      svg.style.width = `${w}px`;
      svg.style.height = `${h}px`;
      svg.setAttribute("width", `${w}`);
      svg.setAttribute("height", `${h}`);

      const mjxHtml = mjx as HTMLElement;
      mjxHtml.style.width = `${w}px`;
      mjxHtml.style.height = `${h}px`;
      mjxHtml.style.display = "inline-block";
    } else {
      const exToPx = 8;
      const attrWidth = svg.getAttribute("width");
      const attrHeight = svg.getAttribute("height");

      if (attrWidth && attrWidth.endsWith("ex")) {
        const val = parseFloat(attrWidth) * exToPx;
        svg.style.width = `${val}px`;
        svg.setAttribute("width", `${val}`);
        (mjx as HTMLElement).style.width = `${val}px`;
      }
      if (attrHeight && attrHeight.endsWith("ex")) {
        const val = parseFloat(attrHeight) * exToPx;
        svg.style.height = `${val}px`;
        svg.setAttribute("height", `${val}`);
        (mjx as HTMLElement).style.height = `${val}px`;
      }
      (mjx as HTMLElement).style.display = "inline-block";
    }
  });
}

(window as any).startExport = async function (data: ExportData) {
  try {
    const container = document.getElementById("export-container");
    if (!container) throw new Error("Export container not found");

    // 古いスタイルや要素をクリア
    container.innerHTML = "";
    const oldStyles = document.querySelectorAll("style[data-export-style]");
    oldStyles.forEach((style) => style.remove());

    // CSSの適用
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-export-style", "true");
    styleEl.textContent = data.slidesCss;
    document.head.appendChild(styleEl);

    // スライドHTMLの挿入
    container.innerHTML = data.slidesHtml;

    // 💡 エクスポート前のDOM最適化前処理 (非同期処理を含むため await 実行)
    preprocessMathJax(container);
    await preprocessCodeBlocks(container);

    // スライドの全ページ要素 (.page) を抽出
    const pages = container.querySelectorAll(".page");
    if (pages.length === 0) {
      throw new Error("No slide pages found to export");
    }

    // dom-to-pptxでエクスポートを実行
    await exportToPptx(Array.from(pages), {
      fileName: data.fileName || "presentation.pptx",
      svgAsVector: true, // SVGをベクターとしてPowerPointへエクスポート
    });

    // 成功を親ウィンドウに通知
    if (window.parent && (window.parent as any).onPptxExportComplete) {
      (window.parent as any).onPptxExportComplete();
    }
  } catch (error: any) {
    console.error("PPTX Export Error:", error);
    if (window.parent && (window.parent as any).onPptxExportError) {
      (window.parent as any).onPptxExportError(error.message || String(error));
    }
  }
};
