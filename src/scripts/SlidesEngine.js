/**
 * ============================================================
 * Dynamic Markdown Slides - Core Slide Engine (AST-Driven)
 * ============================================================
 * Markdown文字列を解析し、[ヘッダー, コンテンツコンテナ, フッター] の
 * スライド正規レイアウトの組み替え、および <div class="slides"> 全体の
 * HTML構造の構築までを一括して行う決定版コア変換エンジン。
 */

import { marked } from "marked";
import hljs from "highlight.js";
import { createMarkedColonPlugin } from "./plugins/marked/MarkedColonExtensions.js";
import { createMarkedImageAttributesPlugin } from "./plugins/marked/MarkedImageAttributesExtension.js";
import { createMarkedVariablesPlugin } from "./plugins/marked/MarkedVariablesPlugin.js";


function getMetaInitialText(token) {
    if (!token) return '';
    if (token.tokens && token.tokens.length > 0) {
        return token.tokens.map(t => t.text || '').join('');
    }
    return token.text || '';
}

export const SlidesEngine = {
    /**
     * Markdownテキストを受け取り、<div class="slides">を含めた完全なHTMLテキストを返す
     * @param {string} markdownText - 生のMarkdown文字列
     * @returns {Object} { html, title }
     */
    run(markdownText) {
        if (!markdownText) return { html: '<div class="slides"></div>', title: '' };

        // Windows環境の改行コード(\r\n)干渉を防ぐ
        markdownText = markdownText.replace(/\r/g, '');

        // 内部で使用するMarkedプラグインの初期化
        marked.use(createMarkedColonPlugin());
        marked.use(createMarkedImageAttributesPlugin());

        // パース段階でHighlight.jsを適用する共通レンダラー設定
        marked.use({
            renderer: {
                code({ text, lang }) {
                    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
                    const highlighted = hljs.highlight(text, { language }).value;
                    return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
                }
            }
        });

        // 1. 全文を字句解析（Lexer）にかけてドキュメント全体のTokenツリー（AST）を構築
        const allTokens = marked.lexer(markdownText);

        // 2. 水平線（hr）を境界線としてセグメント（スライド単位）に分割
        const segments = [];
        let currentSegment = [];

        allTokens.forEach(token => {
            if (token.type === 'hr') {
                segments.push(currentSegment);
                currentSegment = [];
            } else {
                currentSegment.push(token);
            }
        });
        segments.push(currentSegment);

        // 3. 第0セグメント（メタ情報領域）からすべての最上位要素を動的にマッピング
        const metaSpace = {};
        const metaSegment = segments[0];

        metaSegment.forEach(token => {
            let tagName = token.tagName;
            if (!tagName && token.type === 'html') {
                const match = token.raw.match(/<([a-zA-Z0-9:-]+)/);
                if (match) tagName = match[1].toLowerCase();
            }

            if (tagName) {
                metaSpace[tagName] = token;
                if (tagName === 'title') {
                    metaSpace._titleText = getMetaInitialText(token).trim();
                }
            }
        });

        // 4. 各スライドセグメントの構造最適化ループ
        const slideSegments = segments.slice(1);
        const totalPages = slideSegments.length;
        let combinedSlidesHtml = '';

        slideSegments.forEach((slideTokens, index) => {
            const pageNum = index + 1;

            // ① ヘッダーの分離
            let headerToken = null;
            const headerIdx = slideTokens.findIndex(t =>
                t.tagName === 'header' || (t.type === 'html' && /^<header/i.test(t.raw))
            );
            if (headerIdx !== -1) {
                headerToken = slideTokens.splice(headerIdx, 1)[0];
            }

            // ② フッターの分離と共通補完
            const footerIdx = slideTokens.findIndex(t =>
                t.tagName === 'footer' || (t.type === 'html' && /^<footer/i.test(t.raw))
            );

            let footerToken = null;
            if (footerIdx !== -1) {
                footerToken = slideTokens.splice(footerIdx, 1)[0];
            } else if (metaSpace.footer) {
                footerToken = JSON.parse(JSON.stringify(metaSpace.footer));
            }

            // ③ コンテンツコンテナ（div.content）の再構成
            const contentContainerToken = {
                type: 'colonBlock',
                tagName: 'div',
                attrsHtml: ' class="content"',
                tokens: slideTokens
            };

            const optimizedTokens = [];
            if (headerToken) optimizedTokens.push(headerToken);
            optimizedTokens.push(contentContainerToken);
            if (footerToken) optimizedTokens.push(footerToken);

            // ④ 変数解決プラグインを動的に生成して実行
            const variablesPlugin = createMarkedVariablesPlugin({
                pageNum: pageNum,
                totalPages: totalPages,
                meta: metaSpace
            });
            marked.walkTokens(optimizedTokens, variablesPlugin.walkTokens);

            // ⑤ 各スライドのHTML文字列化
            const slideHtml = marked.parser(optimizedTokens);

            combinedSlidesHtml += `
                    <div class="slide" id="slide-${pageNum}">
                        ${slideHtml}
                    </div>
                `;
        });

        // 💡 【仕様変更】全体を <div class="slides"> コンテナで美しくラップして返却
        const finalizedHtml = `<div class="slides">\n${combinedSlidesHtml}</div>`;

        return {
            html: finalizedHtml,
            title: metaSpace._titleText || ''
        };
    }
};