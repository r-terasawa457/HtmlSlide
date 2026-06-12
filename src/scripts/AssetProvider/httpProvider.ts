import type { IAssetProvider } from "./types";

const createTextBlobUrl = (content: string, contentType: string): string => {
  const blob = new Blob([content], { type: contentType });
  return URL.createObjectURL(blob);
};

export const httpProvider: IAssetProvider = {
  async resolveAssetUrl(path: string): Promise<string> {
    return `${window.location.origin}/${path}`;
  },

  async resolveStyleTag(path: string): Promise<string> {
    const url = await this.resolveAssetUrl(path);
    return `<link rel="stylesheet" href="${url}" />`;
  },

  async resolveThemeCss(name: string): Promise<string> {
    return this.resolveAssetContent(`themes/${name}`);
  },

  async resolveAssetContent(path: string): Promise<string> {
    const response = await fetch("/" + path);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset content: ${path}`);
    }
    return response.text();
  },

  async resolveScriptTag(path: string): Promise<string> {
    const url = await this.resolveAssetUrl(path);
    return `<script type="module" src="${url}"></script>`;
  },

  async resolveCompositeHtmlUrl(templatePath: string): Promise<string> {
    const htmlText = await this.resolveAssetContent(templatePath);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");
    const origin = window.location.origin;

    doc.querySelectorAll("script[src]").forEach((el) => {
      const src = el.getAttribute("src") || "";
      if (!src.startsWith("http") && !src.startsWith("/")) {
        el.setAttribute("src", `${origin}/${src}`);
      }
    });

    doc.querySelectorAll("link[rel='stylesheet'][href]").forEach((el) => {
      const href = el.getAttribute("href") || "";
      if (!href.startsWith("http") && !href.startsWith("/")) {
        el.setAttribute("href", `${origin}/${href}`);
      }
    });

    const serializedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    return createTextBlobUrl(serializedHtml, "text/html");
  },
};
