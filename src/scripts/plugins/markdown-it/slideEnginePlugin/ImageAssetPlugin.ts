import MarkdownIt from "markdown-it";
import Token from "markdown-it/lib/token.mjs";
import { type SlideEnv } from "./MetaParser";

/**
 * 画像属性文字列を解析してHTML属性の形式に変換します。
 */
function parseAttributes(
  str: string | null | undefined,
  defaultAttrName: string,
): string {
  if (!str || str.trim() === "") return "";

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

  for (const token of tokens) {
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
  }

  let attrsHtml = "";
  if (attrMap.class.length > 0)
    attrsHtml += ` class="${attrMap.class.join(" ")}"`;
  if (attrMap.style.length > 0)
    attrsHtml += ` style="${attrMap.style.join(" ")}"`;
  if (otherAttrs.length > 0) attrsHtml += ` ${otherAttrs.join(" ")}`;

  return attrsHtml;
}

/**
 * トークンの子要素からテキストコンテンツを抽出します。
 */
function renderTokenChildrenContent(token: Token): string {
  if (!token.children) return "";
  return token.children.map((child) => child.content || "").join("");
}

/**
 * Markdown内の画像パスを、環境変数(env.assets)に定義されたBase64データURLへ動的に置換するプラグイン。
 * クォーテーションやURLエンコードされたクォーテーションで囲まれている場合も自動でアンラップして処理します。
 */
export function imageAssetPlugin(md: MarkdownIt): void {
  md.renderer.rules.image = (tokens, idx, options, env: SlideEnv) => {
    const token = tokens[idx];
    if (!token) return "";

    let src = token.attrGet("src") || "";
    src = src
      .replace(/^(['"]|%22|%27)+/, "")
      .replace(/(['"]|%22|%27)+$/, "")
      .trim();

    const title = token.attrGet("title") || "";
    const rawAlt = renderTokenChildrenContent(token).trim();
    const rawAttrStr = `${rawAlt} img-fluid`.trim();
    const attrsHtml = parseAttributes(rawAttrStr, "class");
    const assets = env.assets || {};

    const cleanSrc = src.replace(/^(\.\.\/|\.\/)+/, "").toLowerCase();
    let matchedAsset = assets[cleanSrc] || null;

    if (!matchedAsset) {
      const keys = Object.keys(assets);
      for (const key of keys) {
        if (key.endsWith(cleanSrc)) {
          matchedAsset = assets[key] || null;
          break;
        }
      }
    }

    if (matchedAsset) src = matchedAsset;

    const altText = title ? `${title.trim()}の画像` : "";
    const titleAttr = title ? ` title="${title.trim()}"` : "";

    return `<img src="${src}"${attrsHtml} alt="${altText}"${titleAttr}>`;
  };
}
