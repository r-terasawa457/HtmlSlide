import type { IAssetProvider } from "./types";

export const httpProvider: IAssetProvider = {
  async resolveAssetUrl(path: string): Promise<string> {
    return "/" + path;
  },

  async resolveStyleTag(path: string): Promise<string> {
    return `<link rel="stylesheet" href="/${path}" />`;
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
    return `<script type="module" src="/${path}"></script>`;
  },

  async resolvePresenterUrl(): Promise<string> {
    return "/presenter.html";
  },
};
