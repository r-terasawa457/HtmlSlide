import { AssetProvider } from "./AssetProvider";

/**
 * PPTXエクスポートの実行オプション
 */
export interface PptxExportOptions {
  slidesHtml: string;
  fileName: string;
}

/**
 * 画面外の非表示iframeを利用したPPTXエクスポート処理を統括・管理するクラス
 */
export class PptxExportController {
  /**
   * 一時的なiframeを生成し、安全にPPTXエクスポートを実行します
   */
  public static async export(options: PptxExportOptions): Promise<void> {
    const { slidesHtml, fileName } = options;

    const iframe = document.createElement("iframe");
    this.applyHiddenStyles(iframe);

    return new Promise<void>(async (resolve, reject) => {
      const cleanup = () => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        delete (window as any).onPptxExportComplete;
        delete (window as any).onPptxExportError;
      };

      (window as any).onPptxExportComplete = () => {
        cleanup();
        resolve();
      };

      (window as any).onPptxExportError = (msg: string) => {
        cleanup();
        reject(new Error(msg));
      };

      try {
        const pptxExportTemplate = await AssetProvider.resolveAssetContent(
          "src/pptx_export.html",
        );
        const pptxExportScript =
          await AssetProvider.resolveScriptTag("dist/pptxExport.js");

        const pptxExportHtml = pptxExportTemplate.replace(
          "",
          () => pptxExportScript,
        );

        iframe.srcdoc = pptxExportHtml;

        iframe.onload = async () => {
          const exportWin = iframe.contentWindow as any;
          if (exportWin && exportWin.startExport) {
            const slidesCss = await AssetProvider.resolveAssetContent(
              "src/css/slide_root.css",
            );
            exportWin.startExport({
              slidesHtml,
              slidesCss,
              fileName,
            });
          } else {
            (window as any).onPptxExportError(
              "エクスポートモジュールの読み込みに失敗しました。",
            );
          }
        };

        document.body.appendChild(iframe);
      } catch (err) {
        cleanup();
        reject(err);
      }
    });
  }

  private static applyHiddenStyles(iframe: HTMLIFrameElement): void {
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "-9999px";
    iframe.style.width = "1280px";
    iframe.style.height = "720px";
    iframe.style.border = "none";
  }
}
