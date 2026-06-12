import type { IAssetProvider } from "./types";

const blobUrlCache: Record<string, string> = {};

const getEmbeddedAsset = (path: string): string => {
  const assets = (globalThis as any).EmbeddedAssets || {};
  return assets[path] || "";
};

const createTextBlobUrl = (content: string, contentType: string): string => {
  const blob = new Blob([content], { type: contentType });
  return URL.createObjectURL(blob);
};

const normalizePath = (path: string): string => {
  return path.replace(/^\.\//, "");
};

export const portableProvider: IAssetProvider = {
  async resolveAssetUrl(path: string): Promise<string> {
    if (blobUrlCache[path]) {
      return blobUrlCache[path];
    }
    const content = await this.resolveAssetContent(path);
    if (!content) {
      throw new Error(`Asset not found in EmbeddedAssets: ${path}`);
    }

    let type = "text/plain";
    if (path.endsWith(".html")) type = "text/html";
    else if (path.endsWith(".css")) type = "text/css";
    else if (path.endsWith(".js")) type = "application/javascript";

    const url = createTextBlobUrl(content, type);
    blobUrlCache[path] = url;
    return url;
  },

  async resolveStyleTag(path: string): Promise<string> {
    const content = await this.resolveAssetContent(path);
    return `<style>${content}</style>`;
  },

  async resolveThemeCss(name: string): Promise<string> {
    return this.resolveAssetContent(`themes/${name}`);
  },

  async resolveAssetContent(path: string): Promise<string> {
    return getEmbeddedAsset(path);
  },

  async resolveScriptTag(path: string): Promise<string> {
    const content = await this.resolveAssetContent(path);
    return `<script type="module">${content}</script>`;
  },

  async resolveCompositeHtmlUrl(templatePath: string): Promise<string> {
    const htmlText = await this.resolveAssetContent(templatePath);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const scripts = doc.querySelectorAll("script[src]");
    for (const script of Array.from(scripts)) {
      const src = script.getAttribute("src") || "";
      if (src.startsWith("http") || src.startsWith("/")) continue;

      const assetContent = await this.resolveAssetContent(normalizePath(src));
      if (!assetContent) continue;

      const inlineScript = doc.createElement("script");
      inlineScript.type = "module";
      inlineScript.textContent = assetContent;
      script.parentNode?.replaceChild(inlineScript, script);
    }

    const links = doc.querySelectorAll("link[rel='stylesheet'][href]");
    for (const link of Array.from(links)) {
      const href = link.getAttribute("href") || "";
      if (href.startsWith("http") || href.startsWith("/")) continue;

      const assetContent = await this.resolveAssetContent(normalizePath(href));
      if (!assetContent) continue;

      const inlineStyle = doc.createElement("style");
      inlineStyle.textContent = assetContent;
      link.parentNode?.replaceChild(inlineStyle, link);
    }

    const serializedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    return createTextBlobUrl(serializedHtml, "text/html");
  },
};
