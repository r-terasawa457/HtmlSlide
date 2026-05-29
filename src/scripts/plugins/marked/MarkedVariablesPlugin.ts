/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Variables Plugin (TS)
 * ============================================================
 */
import type { Token, MarkedExtension } from "marked";

export interface VariablePluginContext {
  pageNum: number;
  totalPages: number;
  meta: Record<string, any>;
}

/**
 * トークン配下の全テキストを再帰的に結合して抽出する (HTMLのtextContent相当)
 */
function getTokenTextContent(token: Token | undefined): string {
  if (!token) return "";
  const t = token as any;
  if (t.tokens && t.tokens.length > 0) {
    return t.tokens.map((child: Token) => getTokenTextContent(child)).join("");
  }
  if (t.text !== undefined) return t.text;
  return "";
}

/**
 * ドット表記のパスからトークンツリーを探索して値を解決する
 */
function getVariableValue(
  pathStr: string,
  context: VariablePluginContext,
): string | null {
  const { pageNum, totalPages, meta } = context;

  if (pathStr === "page-number") return String(pageNum);
  if (pathStr === "page-total") return String(totalPages);

  const path = pathStr.split(".");

  // 💡 安全な配列アクセスを保証し、undefined の可能性を排除するガード
  const firstKey = path[0];
  if (!firstKey) return null;

  let currentToken = meta[firstKey];
  if (!currentToken) return null;

  for (let i = 1; i < path.length; i++) {
    // 💡 ループ内でもインデックス要素の存在を確定させる
    const nextKey = path[i];
    if (!nextKey || !currentToken.tokens) return null;

    const found = currentToken.tokens.find((t: any) => t.tagName === nextKey);
    if (!found) return null;
    currentToken = found;
  }

  return getTokenTextContent(currentToken);
}

/**
 * 現在のページコンテキストを閉じ込めた変数解決プラグインを生成する
 */
export function createMarkedVariablesPlugin(
  context: VariablePluginContext,
): MarkedExtension {
  if (!context) {
    throw new Error("[MarkedVariablesPlugin] context is required.");
  }

  // 💡 MarkedExtension に存在しない 'name' プロパティを除去して型を適合
  return {
    walkTokens(token: Token) {
      if (token.type === "code" || token.type === "codespan") return;

      const replaceStr = (str: string | undefined): string | undefined => {
        if (!str || typeof str !== "string") return str;
        return str.replace(/\$\{([a-zA-Z0-9._-]+)\}/g, (match, varPath) => {
          const resolvedValue = getVariableValue(varPath, context);
          return resolvedValue !== null ? resolvedValue : match;
        });
      };

      const t = token as any;
      if (t.text !== undefined) t.text = replaceStr(t.text);
      if (t.raw !== undefined) t.raw = replaceStr(t.raw);
      if (t.title !== undefined) t.title = replaceStr(t.title);
      if (t.href !== undefined) t.href = replaceStr(t.href);
    },
  };
}
