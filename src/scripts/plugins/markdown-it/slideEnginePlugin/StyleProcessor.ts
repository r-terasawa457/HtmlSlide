import { type SlideEnv } from "./MetaParser";

/**
 * 抽出されたスタイルシート内の @import ルールを解析し、
 * インラインアセットまたはビルトインテーマのCSSテキストへ置換するプロセッサ。
 */
export class StyleProcessor {
  private static readonly IMPORT_REGEX =
    /(\/\*[\s\S]*?\*\/)|(@import\s+['"]([^'"]+)['"];?)/gi;

  /**
   * CSS文字列全体が @scope で囲まれていない場合、自動的に @scope { ... } で囲みます。
   * @param css - 対象のCSS文字列
   * @returns @scope で囲まれたCSS文字列
   */
  public static ensureScope(css: string): string {
    const trimmed = css.trim();
    if (!trimmed.startsWith("@scope")) {
      return `@scope {\n${trimmed}\n}`;
    }
    return trimmed;
  }

  /**
   * CSS文字列を最小化（圧縮）します。
   * @param css - 対象のCSS文字列
   * @returns 最小化されたCSS文字列
   */
  public static minimizeCss(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      .replace(/\s*([{}|:;])\s*/g, "$1")
      .trim();
  }

  /**
   * <style>タグ内のCSS文字列を抽出し、@scope で囲まれていない場合は自動的に囲んだ形式に変換し、さらに最小化します。
   * @param styleContent - <style>...</style> 形式のHTML文字列
   * @returns 最小化および@scope化されたHTML文字列
   */
  public static wrapStyleTagWithScope(styleContent: string): string {
    const trimmed = styleContent.trim();
    const innerCssMatch = trimmed.match(/^<style\b[^>]*>([\s\S]*?)<\/style>/i);
    if (!innerCssMatch) {
      return trimmed;
    }
    const innerCss = (innerCssMatch[1] ?? "").trim();
    const processedCss = this.ensureScope(innerCss);
    const minimizedCss = this.minimizeCss(processedCss);

    const openTagMatch = trimmed.match(/^(<style\b[^>]*>)/i);
    const openTag = openTagMatch?.[1] ?? "<style>";
    return `${openTag}${minimizedCss}</style>`;
  }

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
