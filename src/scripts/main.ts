import "../css/viewer.css";

import { SlidesEngine } from "./SlideEngine2.ts";
import { setupViewer } from "./viewer.ts";
import { AssetProvider } from "./AssetProvider";
import { FileDropScanner, type ScannedFile } from "./FileDropScanner";

interface SlidesResult {
  title?: string;
  html: string;
}

let currentMarkdownText = "";

/**
 * アプリケーションの初期化およびD&Dスキャナーのセットアップを行います
 */
async function init(): Promise<void> {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  new FileDropScanner({
    target: dropZone,
    hoverClass: "dragover",
    onDrop: async (result) => {
      const { files, isFallbackMode } = result;

      if (isFallbackMode && files.length === 1 && files[0].file.size === 0) {
        alert(
          "【ブラウザの制限による通知】\n" +
            "ローカルファイル（file://）環境で実行されているため、ブラウザのセキュリティ制限によりフォルダ構造の直接解析に失敗しました。\n\n" +
            "お手数ですが、フォルダを開いて中身のファイル群をすべて選択（Ctrl + A）し、それらをまとめてドロップしてください。",
        );
        return;
      }

      await processDroppedFiles(files, dropZone);
    },
    onError: (err) => {
      console.error("ファイルのパースに失敗しました:", err);
      alert("ファイルの解析に失敗しました。");
    },
  });
}

/**
 * スキャンされたファイル群のバリデーション、データのパース、およびスライド生成処理を実行します
 */
async function processDroppedFiles(
  droppedFiles: ScannedFile[],
  dropZone: HTMLElement,
): Promise<void> {
  const assetsMap: Record<string, string> = {};
  const duplicateFiles: string[] = [];
  let mdContent = "";
  let mdTitle = "";

  let basePrefix = "";
  const mdDropped = droppedFiles.find((d) => d.file.name.endsWith(".md"));
  if (mdDropped) {
    const lastSlash = mdDropped.relativePath.lastIndexOf("/");
    if (lastSlash >= 0) {
      basePrefix = mdDropped.relativePath
        .substring(0, lastSlash + 1)
        .toLowerCase();
    }
  }

  for (const dropped of droppedFiles) {
    const { relativePath, file } = dropped;

    let key = relativePath.toLowerCase();
    if (basePrefix && key.startsWith(basePrefix)) {
      key = key.substring(basePrefix.length);
    }
    key = key.replace(/^\.\//, "");
    key = encodeURI(key).toLowerCase();

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
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
      }
    } else if (/\.css$/i.test(file.name)) {
      if (assetsMap[key]) {
        duplicateFiles.push(relativePath);
      } else {
        assetsMap[key] = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
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
    alert(
      "Markdownファイル(.md)が見つかりません。ファイルまたはフォルダ内のファイルをすべて選択してドロップしてください。",
    );
    return;
  }

  currentMarkdownText = mdContent;
  const viewerUiTemplate =
    await AssetProvider.resolveAssetContent("src/viewer.html");
  dropZone.style.display = "none";
  document.body.insertAdjacentHTML("beforeend", viewerUiTemplate);

  const builtinThemes = await AssetProvider.resolveAllBuiltinThemes();

  const result = SlidesEngine.run(
    currentMarkdownText,
    assetsMap,
    builtinThemes,
  ) as SlidesResult;
  if (result.title) {
    document.title = result.title;
  } else {
    document.title = mdTitle;
  }

  await setupViewer(result.html);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
