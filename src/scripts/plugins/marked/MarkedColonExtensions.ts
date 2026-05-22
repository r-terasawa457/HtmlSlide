/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Custom Colon Extensions (TS)
 * ============================================================
 */
import type {
  TokenizerThis,
  RendererThis,
  Token,
  MarkedExtension,
} from "marked";
import { parseAttributes } from "./MarkedExtensionUtils";

export type ColonBlockToken = {
  type: "colonBlock";
  raw: string;
  tagName: string;
  attrsHtml: string;
  tokens: Token[];
};

export type ColonInlineBlockToken = {
  type: "colonInlineBlock";
  raw: string;
  tagName: string;
  attrsHtml: string;
  tokens: Token[];
};

/**
 * コロン記法プラグインを生成するファクトリ関数
 */
export function createMarkedColonPlugin(): MarkedExtension {
  const colonBlockExtension = {
    name: "colonBlock",
    level: "block" as const,
    start(src: string): number {
      const match = src.match(/:{3,}/);
      return match ? (match.index ?? -1) : -1;
    },
    tokenizer(this: TokenizerThis, src: string): ColonBlockToken | undefined {
      const match = src.match(/^(\s*)(:{3,})([^\n]*)(?:\n|$)/);
      // 💡 match の存在および各グループが確定しているか厳格にガード
      if (!match || !match[2] || match[3] === undefined) return;

      const colonCount = match[2].length;
      const rawContentAfterColon = match[3];

      let tagName = "div";
      let rawAttrStr = "";

      if (/^\s/.test(rawContentAfterColon)) {
        rawAttrStr = rawContentAfterColon.trim();
      } else {
        const trimmed = rawContentAfterColon.trim();
        const firstSpaceIndex = trimmed.search(/\s/);

        if (firstSpaceIndex === -1) {
          tagName = trimmed || "div";
        } else {
          tagName = trimmed.substring(0, firstSpaceIndex);
          rawAttrStr = trimmed.substring(firstSpaceIndex).trim();
        }
      }

      const attrsHtml = parseAttributes(rawAttrStr, "class");

      const pos = match[0].length;
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

        // 💡 lineMatch[1] の安全なフォールバック確保
        const lineText = lineMatch[1] || "";
        const exactClose = lineText.match(/^\s*(:{3,})\s*$/);

        // 💡 exactClose[1] の存在保証を追加
        if (
          exactClose &&
          exactClose[1] &&
          exactClose[1].length === colonCount
        ) {
          endPos = lineMatch.index;
          includeCloseLine = true;
          closeLineLength = lineMatch[0].length;
          break;
        }

        const openMatch = lineText.match(/^\s*(:{3,})/);
        // 💡 openMatch[1] の存在保証を追加
        if (openMatch && openMatch[1]) {
          const currentColonCount = openMatch[1].length;
          if (currentColonCount >= colonCount) {
            endPos = lineMatch.index;
            break;
          }
        }
      }

      const rawContent = remain.substring(0, endPos);
      const totalLength =
        pos + endPos + (includeCloseLine ? closeLineLength : 0);

      const token: ColonBlockToken = {
        type: "colonBlock",
        raw: src.substring(0, totalLength),
        tagName: tagName.trim(),
        attrsHtml: attrsHtml,
        tokens: [],
      };

      this.lexer.blockTokens(rawContent, token.tokens);
      return token;
    },
    renderer(this: RendererThis, token: Token): string {
      const t = token as unknown as ColonBlockToken;
      const contentHtml = this.parser.parse(t.tokens);
      return `<${t.tagName}${t.attrsHtml}>\n${contentHtml}</${t.tagName}>\n`;
    },
  };

  const colonInlineBlockExtension = {
    name: "colonInlineBlock",
    level: "block" as const,
    start(src: string): number {
      const match = src.match(/::/);
      return match ? (match.index ?? -1) : -1;
    },
    tokenizer(
      this: TokenizerThis,
      src: string,
    ): ColonInlineBlockToken | undefined {
      const match = src.match(/^\s*::([^\n]+?)::\s*([^\n]*)(?:\n|$)/);
      // 💡 インラインブロック側でも、キャプチャグループの存在を厳格に保証
      if (!match || match[1] === undefined || match[2] === undefined) return;

      const rawContentAfterColon = match[1];
      const text = match[2];

      let tagName = "div";
      let rawAttrStr = "";

      if (/^\s/.test(rawContentAfterColon)) {
        rawAttrStr = rawContentAfterColon.trim();
      } else {
        const trimmed = rawContentAfterColon.trim();
        const firstSpaceIndex = trimmed.search(/\s/);

        if (firstSpaceIndex === -1) {
          tagName = trimmed || "div";
        } else {
          tagName = trimmed.substring(0, firstSpaceIndex);
          rawAttrStr = trimmed.substring(firstSpaceIndex).trim();
        }
      }

      const attrsHtml = parseAttributes(rawAttrStr, "class");

      const token: ColonInlineBlockToken = {
        type: "colonInlineBlock",
        raw: match[0],
        tagName: tagName.trim(),
        attrsHtml: attrsHtml,
        tokens: [],
      };

      this.lexer.inlineTokens(text, token.tokens);
      return token;
    },
    renderer(this: RendererThis, token: Token): string {
      const t = token as unknown as ColonInlineBlockToken;
      const contentHtml = this.parser.parseInline(t.tokens);
      return `<${t.tagName}${t.attrsHtml}>${contentHtml}</${t.tagName}>\n`;
    },
  };

  return {
    extensions: [colonBlockExtension, colonInlineBlockExtension],
  };
}
