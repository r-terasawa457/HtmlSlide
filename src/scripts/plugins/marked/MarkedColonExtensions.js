/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Custom Colon Extensions (Robust Version)
 * ============================================================
 * 独自コロン記法（:::型ブロック、::型シングルライン）を解析するプラグイン。
 * 行頭のインデント（空白）を許容し、ネストされた構造を確実にASTへとマッピングします。
 */

import { parseAttributes } from "./MarkedExtensionUtils.js";

/**
 * コロン記法プラグインを生成するファクトリ関数
 */
export function createMarkedColonPlugin(options) {

    const colonBlockExtension = {
        name: 'colonBlock',
        level: 'block',
        start(src) {
            const match = src.match(/:{3,}/);
            return match ? match.index : -1;
        },
        tokenizer(src, tokens) {
            // 【修正】行頭の任意のインデントスペース（\s*）を許容
            const match = src.match(/^(\s*)(:{3,})([^\n]*)(?:\n|$)/);
            if (!match) return;

            const colonCount = match[2].length;
            const rawContentAfterColon = match[3];

            let tagName = 'div';
            let rawAttrStr = '';

            if (/^\s/.test(rawContentAfterColon)) {
                rawAttrStr = rawContentAfterColon.trim();
            } else {
                const trimmed = rawContentAfterColon.trim();
                const firstSpaceIndex = trimmed.search(/\s/);

                if (firstSpaceIndex === -1) {
                    tagName = trimmed || 'div';
                } else {
                    tagName = trimmed.substring(0, firstSpaceIndex);
                    rawAttrStr = trimmed.substring(firstSpaceIndex).trim();
                }
            }

            const attrsHtml = parseAttributes(rawAttrStr, 'class');

            let pos = match[0].length;
            const remain = src.substring(pos);

            const lineRegex = /^([^\n]*)(?:\n|$)/gm;
            let lineMatch;
            let endPos = remain.length;
            let includeCloseLine = false;
            let closeLineLength = 0;

            while ((lineMatch = lineRegex.exec(remain)) !== null) {
                if (lineMatch[0].length === 0) {
                    if (lineRegex.lastIndex === remain.length) break;
                    lineRegex.lastIndex++;
                    continue;
                }

                const lineText = lineMatch[1];

                // 【修正】閉じ行の前にインデントスペースがあっても正確に検知可能に
                const exactClose = lineText.match(/^\s*(:{3,})\s*$/);
                if (exactClose && exactClose[1].length === colonCount) {
                    endPos = lineMatch.index;
                    includeCloseLine = true;
                    closeLineLength = lineMatch[0].length;
                    break;
                }

                // 【修正】自動閉じ判定のインデントスペース対応
                const openMatch = lineText.match(/^\s*(:{3,})/);
                if (openMatch) {
                    const currentColonCount = openMatch[1].length;
                    if (currentColonCount >= colonCount) {
                        endPos = lineMatch.index;
                        break;
                    }
                }
            }

            const rawContent = remain.substring(0, endPos);
            const totalLength = pos + endPos + (includeCloseLine ? closeLineLength : 0);

            const token = {
                type: 'colonBlock',
                raw: src.substring(0, totalLength),
                tagName: tagName.trim(),
                attrsHtml: attrsHtml,
                tokens: []
            };

            this.lexer.blockTokens(rawContent, token.tokens);
            return token;
        },
        renderer(token) {
            const contentHtml = this.parser.parse(token.tokens);
            return `<${token.tagName}${token.attrsHtml}>\n${contentHtml}</${token.tagName}>\n`;
        }
    };

    const colonInlineBlockExtension = {
        name: 'colonInlineBlock',
        level: 'block',
        start(src) {
            const match = src.match(/::/);
            return match ? match.index : -1;
        },
        tokenizer(src, tokens) {
            // 【修正】インラインブロック（::）の前方のインデントスペースを許容
            const match = src.match(/^\s*::([^\n]+?)::\s*([^\n]*)(?:\n|$)/);
            if (!match) return;

            const rawContentAfterColon = match[1];
            const text = match[2];

            let tagName = 'div';
            let rawAttrStr = '';

            if (/^\s/.test(rawContentAfterColon)) {
                rawAttrStr = rawContentAfterColon.trim();
            } else {
                const trimmed = rawContentAfterColon.trim();
                const firstSpaceIndex = trimmed.search(/\s/);

                if (firstSpaceIndex === -1) {
                    tagName = trimmed || 'div';
                } else {
                    tagName = trimmed.substring(0, firstSpaceIndex);
                    rawAttrStr = trimmed.substring(firstSpaceIndex).trim();
                }
            }

            const attrsHtml = parseAttributes(rawAttrStr, 'class');

            const token = {
                type: 'colonInlineBlock',
                raw: match[0],
                tagName: tagName.trim(),
                attrsHtml: attrsHtml,
                tokens: []
            };

            this.lexer.inlineTokens(text, token.tokens);
            return token;
        },
        renderer(token) {
            const contentHtml = this.parser.parseInline(token.tokens);
            return `<${token.tagName}${token.attrsHtml}>${contentHtml}</${token.tagName}>\n`;
        }
    };

    return {
        extensions: [
            colonBlockExtension,
            colonInlineBlockExtension
        ]
    };
}