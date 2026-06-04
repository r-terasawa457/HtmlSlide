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
   * * @param cssText - 置換対象のCSS文字列
   * @param env - スライドの環境変数コンテキスト
   * @returns @import が解決・展開されたCSS文字列
   */
  public static process(cssText: string, env: SlideEnv): string {
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

        const exactAsset = assets[cleanPath];
        if (exactAsset !== undefined) return exactAsset;

        const assetKeys = Object.keys(assets);
        for (const key of assetKeys) {
          if (key.endsWith(cleanPath)) {
            const suffixAsset = assets[key];
            if (suffixAsset !== undefined) return suffixAsset;
          }
        }

        const exactBuiltin = builtinThemes[importPath];
        if (exactBuiltin !== undefined) return exactBuiltin;

        const cleanBuiltin = builtinThemes[cleanPath];
        if (cleanBuiltin !== undefined) return cleanBuiltin;

        return match;
      },
    );
  }
}
