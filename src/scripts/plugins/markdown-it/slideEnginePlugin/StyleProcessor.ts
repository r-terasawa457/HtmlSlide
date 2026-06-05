import { type SlideEnv } from "./MetaParser";

/**
 * 抽出されたスタイルシート内の @import ルールを解析し、
 * インラインアセットまたはビルトインテーマのCSSテキストへ置換するプロセッサ。
 */
export class StyleProcessor {
  private static readonly IMPORT_REGEX =
    /(\/\*[\s\S]*?\*\/)|(@import\s+['"]([^'"]+)['"];?)/gi;

  /**
   * 指定されたCSSテキスト内の @import ルールを env のアセット定義に基づいて解決します。
   * * @param cssText - 置換対象 of CSS文字列
   * @param env - スライドの環境変数コンテキスト
   * @param visited - 無限ループ防止および重複ロード防止用のインポート済みキーのセット
   * @returns @import が解決・展開されたCSS文字列
   */
  public static process(
    cssText: string,
    env: SlideEnv,
    visited: Set<string> = new Set<string>(),
  ): string {
    const assets = env.assets || {};
    const builtinThemes = env.builtinThemes || {};

    return cssText.replace(
      this.IMPORT_REGEX,
      (match, comment, importRule, importPath) => {
        if (comment) return match;
        if (!importPath || /^https?:\/\//i.test(importPath)) return match;

        const cleanPath = importPath
          .replace(/^(\.\.\/|\.\/)+/, "")
          .toLowerCase();

        let matchedKey: string | null = null;
        let resolvedCss: string | null = null;

        const exactAsset = assets[cleanPath];
        if (exactAsset !== undefined) {
          matchedKey = `asset:${cleanPath}`;
          resolvedCss = exactAsset;
        } else {
          const assetKeys = Object.keys(assets);
          for (const key of assetKeys) {
            if (key.endsWith(cleanPath)) {
              const suffixAsset = assets[key];
              if (suffixAsset !== undefined) {
                matchedKey = `asset:${key}`;
                resolvedCss = suffixAsset;
                break;
              }
            }
          }
        }

        if (resolvedCss === null) {
          const exactBuiltin = builtinThemes[importPath];
          if (exactBuiltin !== undefined) {
            matchedKey = `builtin:${importPath.replace(/^(\.\.\/|\.\/)+/, "").toLowerCase()}`;
            resolvedCss = exactBuiltin;
          } else {
            const cleanBuiltin = builtinThemes[cleanPath];
            if (cleanBuiltin !== undefined) {
              matchedKey = `builtin:${cleanPath}`;
              resolvedCss = cleanBuiltin;
            }
          }
        }

        if (resolvedCss !== null && matchedKey !== null) {
          if (visited.has(matchedKey)) {
            return "";
          }
          visited.add(matchedKey);
          return this.process(resolvedCss, env, visited);
        }

        return match;
      },
    );
  }
}
