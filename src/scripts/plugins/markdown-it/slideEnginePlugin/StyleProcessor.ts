import { type SlideEnv } from "./MetaParser";

/**
 * 抽出されたスタイルシート内の @import ルールを解析し、
 * インラインアセットまたはビルトインテーマのCSSテキストへ置換するプロセッサ。
 */
export class StyleProcessor {
  private static readonly IMPORT_REGEX =
    /(\/\*[\s\S]*?\*\/)|(@import\s+['"]([^'"]+)['"];?)/gi;

  /**
   * 指定されたCSSテキスト内の @import ルールを env のアセット定義に基づいて解決する。
   */
  public static process(cssText: string, env: SlideEnv): string {
    const assets = env.assets || {};
    const builtinThemes = env.builtinThemes || {};

    return cssText.replace(
      this.IMPORT_REGEX,
      (match, comment, importRule, importPath) => {
        // コメントアウト、または外部URLの場合はそのままマッチした文字列を返す
        if (comment) return match;
        if (!importPath || /^https?:\/\//i.test(importPath)) return match;

        const cleanPath = importPath
          .replace(/^(\.\.\/|\.\/)+/, "")
          .toLowerCase();

        // 1. assets から完全一致で検索
        const exactAsset = assets[cleanPath];
        if (exactAsset !== undefined) return exactAsset;

        // 2. assets のキー後方一致で検索
        const assetKeys = Object.keys(assets);
        for (const key of assetKeys) {
          if (key.endsWith(cleanPath)) {
            const suffixAsset = assets[key];
            if (suffixAsset !== undefined) return suffixAsset;
          }
        }

        // 3. ビルトインテーマから検索
        const exactBuiltin = builtinThemes[importPath];
        if (exactBuiltin !== undefined) return exactBuiltin;

        const cleanBuiltin = builtinThemes[cleanPath];
        if (cleanBuiltin !== undefined) return cleanBuiltin;

        // どこにもマッチしなかった場合は元の記述を維持
        return match;
      },
    );
  }
}
