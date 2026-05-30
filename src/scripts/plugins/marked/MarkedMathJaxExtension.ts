/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js MathJax Extension (TS)
 * ============================================================
 */
import type {
  TokenizerThis,
  RendererThis,
  Token,
  MarkedExtension,
} from "marked";

/**
 * MathJaxブロック数式トークンの型定義
 */
export type MathBlockToken = {
  type: "mathBlock";
  raw: string;
  text: string;
};

/**
 * MathJaxインライン数式トークンの型定義
 */
export type MathInlineToken = {
  type: "mathInline";
  raw: string;
  text: string;
};

/**
 * MathJax数式（ブロック・インライン）用のプラグインを生成するファクトリ関数
 * @returns MarkedExtension オブジェクト
 */
export function createMarkedMathJaxPlugin(): MarkedExtension {
  const mathBlockExtension = {
    name: "mathBlock",
    level: "block" as const,
    start(src: string): number {
      const match = src.match(/\$\$/);
      return match ? (match.index ?? -1) : -1;
    },
    tokenizer(this: TokenizerThis, src: string): MathBlockToken | undefined {
      const validMatch = src.match(/^(\s*)\$\$(?:\n|$)/);
      if (!validMatch) return;

      const pos = validMatch[0].length;
      const remain = src.substring(pos);

      const lineRegex = /^([^\n]*)(?:\n|$)/gm;
      let lineMatch: RegExpExecArray | null;
      let endPos = remain.length;
      let includeCloseLine = false;
      let closeLineLength = 0;

      while ((lineMatch = lineRegex.exec(remain)) !== null) {
        if (lineMatch[0].length === 0) {
          if (lineRegex.lastIndex === remain.length) break;
          lineRegex.lastIndex++;
          continue;
        }

        const lineText = lineMatch[1] || "";

        if (/^\s*\$\$\s*$/.test(lineText)) {
          endPos = lineMatch.index;
          includeCloseLine = true;
          closeLineLength = lineMatch[0].length;
          break;
        }

        if (/^---\s*$/.test(lineText)) {
          endPos = lineMatch.index;
          includeCloseLine = false;
          break;
        }
      }

      const mathContent = remain.substring(0, endPos);
      const totalLength =
        pos + endPos + (includeCloseLine ? closeLineLength : 0);

      return {
        type: "mathBlock",
        raw: src.substring(0, totalLength),
        text: mathContent.trim(),
      };
    },
    renderer(this: RendererThis, token: Token): string {
      const t = token as unknown as MathBlockToken;
      return `<div class="math-block">$$\n${t.text}\n$$</div>\n`;
    },
  };

  const mathInlineExtension = {
    name: "mathInline",
    level: "inline" as const,
    start(src: string): number {
      const match = src.match(/\$/);
      return match ? (match.index ?? -1) : -1;
    },
    tokenizer(this: TokenizerThis, src: string): MathInlineToken | undefined {
      // 💡 否定先読み (?!\{) を追加： $ の後ろが { の場合はカスタム変数とみなして数式パースをスキップ
      const match = src.match(/^\$(?!\{)((?:\\\$|[^\$\n])+?)\$/);
      if (!match || match[1] === undefined) return;

      return {
        type: "mathInline",
        raw: match[0],
        text: match[1],
      };
    },
    renderer(this: RendererThis, token: Token): string {
      const t = token as unknown as MathInlineToken;
      return `<span class="math-inline">$${t.text}$</span>`;
    },
  };

  return {
    extensions: [mathBlockExtension, mathInlineExtension],
  };
}
