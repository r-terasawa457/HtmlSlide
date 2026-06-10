import type { IAssetProvider } from "./types";

export const httpProvider: IAssetProvider = {
  async resolveAssetUrl(path: string): Promise<string> {
    return `${window.location.origin}/${path}`;
  },

  async resolveStyleTag(path: string): Promise<string> {
    return `<link rel="stylesheet" href="${window.location.origin}/${path}" />`;
  },

  async resolveThemeCss(name: string): Promise<string> {
    const response = await fetch(`/themes/${name}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch theme CSS: ${name}`);
    }
    return response.text();
  },

  async resolveAssetContent(path: string): Promise<string> {
    const response = await fetch("/" + path);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset content: ${path}`);
    }
    return response.text();
  },

  async resolveScriptTag(path: string): Promise<string> {
    return `<script type="module" src="${window.location.origin}/${path}"></script>`;
  },

  async resolvePresenterUrl(): Promise<string> {
    const presenterTemplate =
      await httpProvider.resolveAssetContent("src/presenter.html");
    const presenterStyle = await httpProvider.resolveStyleTag(
      "src/css/presenter.css",
    );
    const presenterScript =
      await httpProvider.resolveScriptTag("dist/presenter.js");

    const presenterHtml = presenterTemplate
      .replace("", () => presenterStyle)
      .replace("", () => presenterScript);

    const blob = new Blob([presenterHtml], { type: "text/html" });
    return URL.createObjectURL(blob);
  },
};
