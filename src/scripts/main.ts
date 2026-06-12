import "../css/viewer.css";

import { SlidesEngine } from "./SlideEngine2.ts";
import { setupViewer } from "./viewer.ts";
import { AssetProvider } from "./AssetProvider";

interface SlidesResult {
  title?: string;
  html: string;
}

interface DroppedFile {
  relativePath: string;
  file: File;
}

let currentMarkdownText = "";

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
        const entries: FileSystemEntry[] = [];
        for (const item of Array.from(items)) {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }

        for (const entry of entries) {
          const files = await collectFilesViaEntries(entry);
          droppedFiles.push(...files);
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
        const filesArr = Array.from(rawFiles as FileList);
        if (isFallbackMode && filesArr.length === 1 && filesArr[0].size === 0) {
          alert(
            "【ブラウザの制限による通知】\n" +
              "ローカルファイル（file://）環境で実行されているため、ブラウザのセキュリティ制限によりフォルダ構造の直接解析に失敗しました。\n\n" +
              "お手数ですが、フォルダを開いて中身のファイル群をすべて選択（Ctrl + A）し、それらをまとめてドロップしてください。",
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

      const builtinThemes = {
        "css/bootstrap.min.css": await AssetProvider.resolveThemeCss(
          "css/bootstrap.min.css",
        ),
        "css/vs.css": await AssetProvider.resolveThemeCss("css/vs.css"),
        "slide-thema-default.css": await AssetProvider.resolveThemeCss(
          "slide-thema-default.css",
        ),
      };

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
    } catch (err) {
      console.error("ファイルのパースに失敗しました:", err);
      alert("ファイルの解析に失敗しました。");
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
