/**
 * ============================================================
 * Dynamic Markdown Slides - Marked.js Variables Plugin
 * ============================================================
 * 完全に marked.use() の標準オブジェクト規格に準拠した変数解決プラグイン。
 */

/**
 * トークン配下の全テキストを再帰的に結合して抽出する (HTMLのtextContent相当)
 */
function getTokenTextContent(token) {
    if (!token) return '';
    if (token.tokens && token.tokens.length > 0) {
        return token.tokens.map(t => getTokenTextContent(t)).join('');
    }
    if (token.text !== undefined) return token.text;
    return '';
}

/**
 * ドット表記のパスからトークンツリーを探索して値を解決する内部関数
 */
function getVariableValue(pathStr, context) {
    const { pageNum, totalPages, meta } = context;

    // 1. システム組み込み変数の解決
    if (pathStr === 'page-number') return String(pageNum);
    if (pathStr === 'page-total') return String(totalPages);

    // 2. メタデータのドットパス探索
    const path = pathStr.split('.');
    let currentToken = meta[path[0]];
    if (!currentToken) return null;

    for (let i = 1; i < path.length; i++) {
        const nextKey = path[i];
        if (!currentToken.tokens) return null;
        const found = currentToken.tokens.find(t => t.tagName === nextKey);
        if (!found) return null;
        currentToken = found;
    }

    return getTokenTextContent(currentToken);
}

/**
 * 現在のページコンテキストを閉じ込めた、正式なプラグインオブジェクトを生成する
 * @param {Object} context - { pageNum, totalPages, meta }
 * @returns {Object} marked.use() に適合するプラグイン構造オブジェクト
 */
export function createMarkedVariablesPlugin(context) {
    if (!context) throw new Error('[MarkedVariablesPlugin] context is required.');
    return {
        name: 'markedVariables',
        walkTokens(token) {
            if (token.type === 'code' || token.type === 'codespan') return;

            const replaceStr = (str) => {
                if (!str || typeof str !== 'string') return str;
                return str.replace(/\$\{([a-zA-Z0-9._-]+)\}/g, (match, varPath) => {
                    const resolvedValue = getVariableValue(varPath, context);
                    return resolvedValue !== null ? resolvedValue : match;
                });
            };

            if (token.text) token.text = replaceStr(token.text);
            if (token.raw) token.raw = replaceStr(token.raw);
            if (token.title) token.title = replaceStr(token.title);
            if (token.href) token.href = replaceStr(token.href);
        }
    };
}

