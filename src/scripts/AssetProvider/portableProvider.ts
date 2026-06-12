import type { IAssetProvider } from "./types";

const blobUrlCache: Record<string, string> = {};

/**
 * グローバル空間から埋め込みアセットを取得する
 */
const getEmbeddedAsset = (path: string): string | undefined => {
  const assets = (globalThis as any).EmbeddedAssets || {};
  return assets[path];
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

  /**
   * 💡 埋め込まれたテーマを並列で一括解決し、マップとして返却
   */
  async resolveAllBuiltinThemes(): Promise<Record<string, string>> {
    const builtinThemes: Record<string, string> = {};
    const themeList = (globalThis as any).BuiltinThemesList || [];

    await Promise.all(
      themeList.map(async (themePath: string) => {
        try {
          builtinThemes[themePath] = await this.resolveThemeCss(themePath);
        } catch (error) {
          console.error(`Failed to resolve builtin theme: ${themePath}`, error);
        }
      }),
    );

    return builtinThemes;
  },

  /**
   * アセットが存在しない場合は明示的に例外をスローし、httpProvider と挙動を合わせる
   */
  async resolveAssetContent(path: string): Promise<string> {
    const content = getEmbeddedAsset(path);
    if (content === undefined) {
      throw new Error(`Asset not found in EmbeddedAssets: ${path}`);
    }
    return content;
  },

  async resolveScriptTag(path: string): Promise<string> {
    const content = (await this.resolveAssetContent(path)).replace(
      /<\/script/gi,
      "<\\/script",
    );
    return `<script type="module">${content}</script>`;
  },

  async resolveCompositeHtmlUrl(templatePath: string): Promise<string> {
    const htmlText = await this.resolveAssetContent(templatePath);

    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, "text/html");

    const scripts = Array.from(doc.querySelectorAll("script[src]"));
    await Promise.all(
      scripts.map(async (script) => {
        const src = script.getAttribute("src") || "";
        if (src.startsWith("http") || src.startsWith("/")) return;

        try {
          const tagHtml = await this.resolveScriptTag(normalizePath(src));
          const template = doc.createElement("template");
          template.innerHTML = tagHtml;
          const inlineScript = template.content.querySelector("script");

          if (inlineScript) {
            script.parentNode?.replaceChild(inlineScript, script);
          }
        } catch (error) {
          console.error(`Failed to inline script: ${src}`, error);
        }
      }),
    );

    const links = Array.from(
      doc.querySelectorAll("link[rel='stylesheet'][href]"),
    );
    await Promise.all(
      links.map(async (link) => {
        const href = link.getAttribute("href") || "";
        if (href.startsWith("http") || href.startsWith("/")) return;

        try {
          const tagHtml = await this.resolveStyleTag(normalizePath(href));
          const template = doc.createElement("template");
          template.innerHTML = tagHtml;
          const inlineStyle = template.content.querySelector("style");

          if (inlineStyle) {
            link.parentNode?.replaceChild(inlineStyle, link);
          }
        } catch (error) {
          console.error(`Failed to inline style: ${href}`, error);
        }
      }),
    );

    const serializedHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
    return createTextBlobUrl(serializedHtml, "text/html");
  },
};
