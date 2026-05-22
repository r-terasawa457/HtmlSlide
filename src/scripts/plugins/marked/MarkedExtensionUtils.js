/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Extension Utilities
 * ============================================================
 * 自作 Marked.js 拡張モジュール間で共有する共通ユーティリティ関数群。
 */

/**
 * 生の属性文字列を解析し、正規のHTML属性文字列を構築する。
 * * 【要求仕様】
 * 1. 属性の分離: 単語、またはクォーテーション（" や '）で囲まれたキー・値のペアを正確に抽出すること。
 * 2. 暗黙の属性指定: イコール（=）を含まない単語は、すべて `defaultAttrName` で指定された属性名として扱うこと。
 * 3. 重複する class 属性の自動マージ: 複数指定された場合は、すべてスペース区切りで1つの `class="..."` に統合すること。
 * 4. 重複する style 属性の自動マージ: 複数指定された場合は、末尾のセミコロンを考慮しつつ1つの `style="..."` に統合すること。
 * 5. その他の属性: `id="値を維持"` のように、指定されたキーと値をそのまま維持して出力すること。
 * 6. 出力形式: 戻り値は、既存のHTMLタグにそのまま結合できるよう、必ず先頭に半角スペースを1つ含めるか、属性がない場合は空文字列とすること。
 * * @param {string} str - 解析対象の生の属性文字列 (例: 'class="row" style="color: red"')
 * @param {string} defaultAttrName - イコールを含まない単語に適用するデフォルトの属性名 (例: 'class')。必須項目。
 * @returns {string} スペースで始まる、即時結合可能なHTML属性文字列 (例: ' class="row" style="color: red;"')
 * @throws {Error} `defaultAttrName` が指定されていない、または空文字列の場合にエラーをスロー。
 * * @example
 * // class をデフォルトにする場合（コロン記法向け）
 * parseAttributes('class="row" style="color: red" d-flow-root', 'class')
 * // => ' class="row d-flow-root" style="color: red;"'
 * * // 重複する class や style の安全なマージ
 * parseAttributes('col-7 style="color:blue;" class="mb-3" style="padding:10px"', 'class')
 * // => ' class="col-7 mb-3" style="color:blue; padding:10px;"'
 */
export function parseAttributes(str, defaultAttrName) {
    if (!defaultAttrName || typeof defaultAttrName !== 'string') {
        throw new Error('[MarkedExtensionUtils] defaultAttrName (string) is required.');
    }

    if (!str || typeof str !== 'string' || str.trim() === '') {
        return '';
    }

    const attrMap = { class: [], style: [] };
    const otherAttrs = [];

    // クォーテーション内の空白を維持しつつ、スペース区切りでトークン（属性群）に分割
    const tokens = str.trim().match(/[^\s"']+(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')?|[^\s]+/g) || [];

    tokens.forEach(token => {
        let key = '';
        let val = '';

        if (token.includes('=')) {
            const eqIndex = token.indexOf('=');
            key = token.substring(0, eqIndex).trim();
            val = token.substring(eqIndex + 1).replace(/^["']|["']$/g, '').trim(); // クォーテーションの除去
        } else {
            // イコールを含まない場合は、引数で指定されたデフォルト属性とみなす
            key = defaultAttrName;
            val = token.trim();
        }

        // 各属性の格納・マージ処理
        if (key === 'class') {
            attrMap.class.push(...val.split(/\s+/));
        } else if (key === 'style') {
            attrMap.style.push(val.endsWith(';') ? val : val + ';');
        } else {
            otherAttrs.push(`${key}="${val}"`);
        }
    });

    // HTML属性文字列の組み立て
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
