import type { IAssetProvider } from "./types";

const blobUrlCache: Record<string, string> = {};

const getEmbeddedAsset = (path: string): string => {
  const assets = (globalThis as any).EmbeddedAssets || {};
  return assets[path] || "";
};

export const portableProvider: IAssetProvider = {
  async resolveAssetUrl(path: string): Promise<string> {
    if (blobUrlCache[path]) {
      return blobUrlCache[path];
    }
    const content = getEmbeddedAsset(path);
    if (!content) {
      throw new Error(`Asset not found in EmbeddedAssets: ${path}`);
    }
    let type = "text/plain";
    if (path.endsWith(".html")) {
      type = "text/html";
    } else if (path.endsWith(".css")) {
      type = "text/css";
    } else if (path.endsWith(".js")) {
      type = "application/javascript";
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    blobUrlCache[path] = url;
    return url;
  },

  async resolveStyleTag(path: string): Promise<string> {
    const content = getEmbeddedAsset(path);
    return `<style>${content}</style>`;
  },

  async resolveThemeCss(name: string): Promise<string> {
    return getEmbeddedAsset(`themes/${name}`);
  },

  async resolveAssetContent(path: string): Promise<string> {
    return getEmbeddedAsset(path);
  },

  async resolveScriptTag(path: string): Promise<string> {
    const content = getEmbeddedAsset(path);
    return `<script type="module">${content}</script>`;
  },

  async resolvePresenterUrl(): Promise<string> {
    const presenterTemplate = getEmbeddedAsset("presenter.html");
    const presenterStyle = `<style>${getEmbeddedAsset("src/css/presenter.css")}</style>`;
    const presenterScript = `<script type="module">${getEmbeddedAsset("dist/presenter.js")}</script>`;

    const presenterHtml = presenterTemplate
      .replace("<!-- PRESENTER_STYLE_TAG -->", () => presenterStyle)
      .replace("<!-- PRESENTER_SCRIPT_TAG -->", () => presenterScript);

    const blob = new Blob([presenterHtml], { type: "text/html" });
    return URL.createObjectURL(blob);
  },
};
