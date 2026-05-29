/**
 * ============================================================
 * Dynamic Markdown Slides - Core Slide Engine (TS)
 * ============================================================
 */
import { marked } from "marked";
import type { Token } from "marked";
import hljs from "highlight.js";
import { createMarkedColonPlugin } from "./plugins/marked/MarkedColonExtensions";
import { createMarkedMathJaxPlugin } from "./plugins/marked/MarkedMathJaxExtension";

import { createMarkedImageAttributesPlugin } from "./plugins/marked/MarkedImageAttributesExtension";
import { createMarkedVariablesPlugin } from "./plugins/marked/MarkedVariablesPlugin";

marked.use(createMarkedColonPlugin());
marked.use(createMarkedMathJaxPlugin());
marked.use(createMarkedImageAttributesPlugin());
marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }): string {
      const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted = hljs.highlight(text, { language }).value;
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
    },
  },
});

function getMetaInitialText(token: any): string {
  if (!token) return "";
  if (token.tokens && token.tokens.length > 0) {
    return token.tokens.map((t: any) => t.text || "").join("");
  }
  return token.text || "";
}

export interface SlidesEngineResult {
  html: string;
  title: string;
}

export const SlidesEngine = {
  /**
   * Rawマークダウンを解析し、スライド集合コンテナのHTMLとメタタイトルを返却する
   * @param markdownText 生のMarkdown文字列
   */
  run(markdownText: string): SlidesEngineResult {
    if (!markdownText) return { html: '<div class="slides"></div>', title: "" };

    markdownText = markdownText.replace(/\r/g, "");
    const allTokens = marked.lexer(markdownText);

    const segments: Token[][] = [];
    let currentSegment: Token[] = [];

    allTokens.forEach((token) => {
      if (token.type === "hr") {
        segments.push(currentSegment);
        currentSegment = [];
      } else {
        currentSegment.push(token);
      }
    });
    segments.push(currentSegment);

    const metaSpace: Record<string, any> = {};
    const metaSegment = segments[0];

    if (metaSegment) {
      metaSegment.forEach((token) => {
        let tagName = (token as any).tagName;
        if (!tagName && token.type === "html") {
          const match = token.raw.match(/<([a-zA-Z0-9:-]+)/);
          // 💡 キャプチャグループの存在まで厳格にチェックして undefined エラーを解消
          if (match && match[1]) tagName = match[1].toLowerCase();
        }

        if (tagName) {
          metaSpace[tagName] = token;
          if (tagName === "title") {
            metaSpace._titleText = getMetaInitialText(token).trim();
          }
        }
      });
    }

    const slideSegments = segments.slice(1);
    const totalPages = slideSegments.length;
    let combinedSlidesHtml = "";

    slideSegments.forEach((slideTokens, index) => {
      const pageNum = index + 1;

      let headerToken: Token | null = null;
      const headerIdx = slideTokens.findIndex(
        (t) =>
          (t as any).tagName === "header" ||
          (t.type === "html" && /^<header/i.test(t.raw)),
      );
      if (headerIdx !== -1) {
        // 💡 配列切り出し時の undefined 可能性を || null で安全に中和
        headerToken = slideTokens.splice(headerIdx, 1)[0] || null;
      }

      const footerIdx = slideTokens.findIndex(
        (t) =>
          (t as any).tagName === "footer" ||
          (t.type === "html" && /^<footer/i.test(t.raw)),
      );

      let footerToken: Token | null = null;
      if (footerIdx !== -1) {
        // 💡 配列切り出し時の undefined 可能性を || null で安全に中和
        footerToken = slideTokens.splice(footerIdx, 1)[0] || null;
      } else if (metaSpace.footer) {
        footerToken = JSON.parse(JSON.stringify(metaSpace.footer));
      }

      const contentContainerToken: any = {
        type: "colonBlock",
        tagName: "div",
        attrsHtml: ' class="content"',
        tokens: slideTokens,
      };

      const optimizedTokens: Token[] = [];
      if (headerToken) optimizedTokens.push(headerToken);
      optimizedTokens.push(contentContainerToken);
      if (footerToken) optimizedTokens.push(footerToken);

      const variablesPlugin = createMarkedVariablesPlugin({
        pageNum,
        totalPages,
        meta: metaSpace,
      });

      if (variablesPlugin.walkTokens) {
        marked.walkTokens(optimizedTokens, variablesPlugin.walkTokens);
      }

      const slideHtml = marked.parser(optimizedTokens);

      combinedSlidesHtml += `
        <div class="slide" id="slide-${pageNum}">
            ${slideHtml}
        </div>
      `;
    });

    const finalizedHtml = `<div class="slides">\n${combinedSlidesHtml}</div>`;

    return {
      html: finalizedHtml,
      title: metaSpace._titleText || "",
    };
  },
};
