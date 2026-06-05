import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import mathjax3 from "markdown-it-mathjax3";
import {
  slideEnginePlugin,
  type SlideEnv,
} from "./plugins/markdown-it/slideEnginePlugin";

const builtinThemesStr = "__BUILTIN_THEMES_PLACEHOLDER__";
let builtinThemes: Record<string, string> = {};
try {
  if (builtinThemesStr && !builtinThemesStr.startsWith("__BUILTIN_THEMES_")) {
    builtinThemes = JSON.parse(builtinThemesStr);
  }
} catch (e) {
  console.error("[SlidesEngine2] Failed to parse builtin themes:", e);
}

export interface SlidesEngineResult {
  html: string;
  title: string;
  env: SlideEnv;
}

/**
 * 画像タグのAltテキスト領域からクラス名やスタイル属性を抽出してHTML属性文字列に変換します。
 * @param str - クラス名や属性が含まれる生文字列
 * @param defaultAttrName - キーが省略された場合のデフォルト属性名（通常は 'class'）
 */
function parseAttributes(
  str: string | null | undefined,
  defaultAttrName: string,
): string {
  if (!defaultAttrName || typeof defaultAttrName !== "string") {
    throw new Error("[SlidesEngine2] defaultAttrName (string) is required.");
  }

  if (!str || typeof str !== "string" || str.trim() === "") {
    return "";
  }

  const attrMap: { class: string[]; style: string[] } = {
    class: [],
    style: [],
  };
  const otherAttrs: string[] = [];
  const tokens =
    str
      .trim()
      .match(
        /[^\s"']+(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')?|[^\s]+/g,
      ) || [];

  tokens.forEach((token) => {
    let key = "";
    let val = "";

    if (token.includes("=")) {
      const eqIndex = token.indexOf("=");
      key = token.substring(0, eqIndex).trim();
      val = token
        .substring(eqIndex + 1)
        .replace(/^['"]|['"]$/g, "")
        .trim();
    } else {
      key = defaultAttrName;
      val = token.trim();
    }

    if (key === "class") {
      attrMap.class.push(...val.split(/\s+/));
    } else if (key === "style") {
      attrMap.style.push(val.endsWith(";") ? val : `${val};`);
    } else {
      otherAttrs.push(`${key}="${val}"`);
    }
  });

  let attrsHtml = "";
  if (attrMap.class.length > 0) {
    attrsHtml += ` class="${attrMap.class.join(" ")}"`;
  }
  if (attrMap.style.length > 0) {
    attrsHtml += ` style="${attrMap.style.join(" ")}"`;
  }
  if (otherAttrs.length > 0) {
    attrsHtml += ` ${otherAttrs.join(" ")}`;
  }

  return attrsHtml;
}

/**
 * トークンの子要素からテキストコンテンツを結合して抽出します。
 * @param token - 操作対象のTokenインスタンス
 */
function renderTokenChildrenContent(token: any): string {
  if (!token || !token.children) return "";
  return token.children.map((child: any) => child.content || "").join("");
}

export const SlidesEngine = {
  /**
   * Markdownテキストを統合プラグインパイプラインで解析し、スライド用HTMLを生成します。
   * @param markdownText - 解析対象のMarkdown文字列
   * @param assets - 相対パスをキーに持つBase64データURL等のマッピングオブジェクト
   */
  run(
    markdownText: string,
    assets: Record<string, string> = {},
  ): SlidesEngineResult {
    if (!markdownText) {
      return {
        html: '<div class="slides"></div>',
        title: "",
        env: { themeStyles: [], variables: {}, slideCount: 0 },
      };
    }

    const normalizedMarkdown = markdownText.replace(/\r/g, "");

    const md = new MarkdownIt({
      html: true,
      linkify: false, // 有効化するとカスタム変数の.がURLと誤認される
      typographer: true,
    });

    md.use(slideEnginePlugin);
    md.use(mathjax3);

    md.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx];
      if (!token) return "";
      const info = token.info ? token.info.trim() : "";
      const lang = info.split(/\s+/)[0] || "";
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(token.content, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
    };

    md.renderer.rules.code_block = (tokens, idx) => {
      const token = tokens[idx];
      if (!token) return "";
      const highlighted = hljs.highlight(token.content, {
        language: "plaintext",
      }).value;
      return `<pre><code class="hljs language-plaintext">${highlighted}</code></pre>\n`;
    };

    const env: SlideEnv = {
      themeStyles: [],
      variables: {},
      slideCount: 0,
      assets,
      builtinThemes,
    };

    const renderedHtml = md.render(normalizedMarkdown, env);
    const finalHtml = `<div class="slides">${renderedHtml}</div>`;

    return {
      html: finalHtml,
      title: env.title || "",
      env,
    };
  },
};
