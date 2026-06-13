<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { FileDropScanner, type ScannedFile } from "../scripts/FileDropScanner";
  import { SlidesEngine } from "../scripts/SlideEngine2";
  import { AssetProvider } from "../scripts/AssetProvider";
  import { viewerState } from "../scripts/ViewerState.svelte";

  interface Props {
    onLoad: () => void;
  }
  let { onLoad }: Props = $props();

  let dropZoneEl = $state<HTMLElement | null>(null);
  let scanner: FileDropScanner | null = null;

  onMount(() => {
    if (!dropZoneEl) return;
    scanner = new FileDropScanner({
      target: dropZoneEl,
      hoverClass: "dragover",
      onDrop: async (result) => {
        const { files, isFallbackMode } = result;

        if (isFallbackMode && files.length === 1 && files[0]?.file.size === 0) {
          alert(
            "【ブラウザの制限による通知】\n" +
              "ローカルファイル（file://）環境で実行されているため、ブラウザのセキュリティ制限によりフォルダ構造の直接解析に失敗しました。\n\n" +
              "お手数ですが、フォルダを開いて中身のファイル群をすべて選択（Ctrl + A）し、それらをまとめてドロップしてください。",
          );
          return;
        }

        await processDroppedFiles(files);
      },
      onError: (err) => {
        console.error("ファイルのパースに失敗しました:", err);
        alert("ファイルの解析に失敗しました。");
      },
    });
  });

  onDestroy(() => {
    if (scanner) {
      scanner.destroy();
    }
  });

  async function processDroppedFiles(
    droppedFiles: ScannedFile[],
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

    const builtinThemes = await AssetProvider.resolveAllBuiltinThemes();
    const result = SlidesEngine.run(mdContent, assetsMap, builtinThemes) as {
      title?: string;
      html: string;
    };

    viewerState.title = result.title || mdTitle;
    viewerState.slidesHtml = result.html;
    viewerState.assetsMap = assetsMap;

    onLoad();
  }
</script>

<div bind:this={dropZoneEl} id="drop-zone">
  <div class="drop-message">
    <h3>Markdownファイルをここにドロップ</h3>
    <p>file:// プロトコルによる完全スタンドアロン動作に対応しています</p>
  </div>
</div>

<style>
  #drop-zone {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #202124;
    color: #e8eaed;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 4px dashed #3c4043;
    margin: 0;
    box-sizing: border-box;
    z-index: 9999;
    font-family: sans-serif;
    transition:
      background-color 0.2s,
      border-color 0.2s;
  }
  :global(#drop-zone.dragover) {
    background: #2d2f34 !important;
    border-color: #8ab4f8 !important;
  }
  .drop-message {
    text-align: center;
    pointer-events: none;
  }
  .drop-message h3 {
    font-size: 24px;
    margin-bottom: 8px;
  }
  .drop-message p {
    color: #9aa0a6;
    font-size: 14px;
  }
</style>
