/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Image Attributes Extension
 * ============================================================
 * Markdown標準の画像記法 `![alt](src "title")` を拡張するモジュール。
 * 1. Marpライクに「alt記述部分」にスタイルクラスや属性を指定可能。
 * 2. 「title記述部分」から、アクセシビリティを高める alt 属性をテンプレートベースで自動生成。
 */

/**
 * 画像属性拡張プラグインを生成するファクトリ関数
 * @param {Object} [options] - 設定オプション
 * @param {string} [options.altTemplate='${imageTitle}の画像'] - HTMLのalt属性に適用するテンプレート文字列。${imageTitle} の部分が画像タイトルに全置換されます。
 * @returns {Object} marked.use() に直接渡せるプラグインオブジェクト（レンダラーオーバーライド型）
 */

import { parseAttributes } from "./MarkedExtensionUtils.js";

export function createMarkedImageAttributesPlugin(options) {
    const config = Object.assign({
        altTemplate: '${imageTitle}の画像'
    }, options);

    // 標準の画像レンダラーをインターセプトするため、
    // extensions 配列ではなく、トップレベルの renderer オブジェクトとして構成して返却します
    return {
        renderer: {
            image({ href, text, title }) {
                // 1. スタイル・属性の抽出（Markdownのaltテキスト記述部分からパース）
                // 全画像にレスポンシブ用の Bootstrap 'img-fluid' クラスを標準付与
                const rawAttrStr = (text || '').trim() + ' img-fluid';
                const attrsHtml = parseAttributes(rawAttrStr, 'class');

                // 2. アクセシビリティ（HTMLとしての alt 属性）の自動生成
                let altText = '';
                if (title) {
                    // テンプレート内のプレースホルダーを、Markdownで指定されたタイトル文字列で安全に全置換
                    altText = config.altTemplate.replaceAll('${imageTitle}', title.trim());
                }

                // 3. HTML文字列の組み立て
                const titleAttr = title ? ` title="${title.trim()}"` : '';
                return `<img src="${href}"${attrsHtml} alt="${altText}"${titleAttr}>`;
            }
        }
    };
}
