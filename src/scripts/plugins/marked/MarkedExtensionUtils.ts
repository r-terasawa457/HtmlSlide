/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Extension Utilities (TS)
 * ============================================================
 */

interface AttributeMap {
  class: string[];
  style: string[];
}

/**
 * 生の属性文字列を解析し、正規のHTML属性文字列をマージ・構築する
 * @param str 解析対象の生の属性文字列 (例: 'class="row" style="color: red"')
 * @param defaultAttrName イコールを含まない単語に適用するデフォルトの属性名 (例: 'class')
 * @returns スペースで始まる、既存のHTMLタグに即時結合可能なHTML属性文字列
 */
export function parseAttributes(str: string | undefined | null, defaultAttrName: string): string {
  if (!defaultAttrName || typeof defaultAttrName !== 'string') {
    throw new Error('[MarkedExtensionUtils] defaultAttrName (string) is required.');
  }

  if (!str || typeof str !== 'string' || str.trim() === '') {
    return '';
  }

  const attrMap: AttributeMap = { class: [], style: [] };
  const otherAttrs: string[] = [];

  // クォーテーション内の空白を維持しつつ、スペース区切りで属性トークン群に分割
  const tokens: string[] = str.trim().match(/[^\s"']+(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')?|[^\s]+/g) || [];

  tokens.forEach(token => {
    let key = '';
    let val = '';

    if (token.includes('=')) {
      const eqIndex = token.indexOf('=');
      key = token.substring(0, eqIndex).trim();
      val = token.substring(eqIndex + 1).replace(/^["']|["']$/g, '').trim();
    } else {
      key = defaultAttrName;
      val = token.trim();
    }

    if (key === 'class') {
      attrMap.class.push(...val.split(/\s+/));
    } else if (key === 'style') {
      attrMap.style.push(val.endsWith(';') ? val : val + ';');
    } else {
      otherAttrs.push(`${key}="${val}"`);
    }
  });

  let attrsHtml = '';
  if (attrMap.class.length > 0) {
    attrsHtml += ` class="${attrMap.class.join(' ')}"`;
  }
  if (attrMap.style.length > 0) {
    attrsHtml += ` style="${attrMap.style.join(' ')}"`;
  }
  if (otherAttrs.length > 0) {
    attrsHtml += ` ${otherAttrs.join(' ')}`;
  }

  return attrsHtml;
}