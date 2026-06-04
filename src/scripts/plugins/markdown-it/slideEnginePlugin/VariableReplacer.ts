import MarkdownIt from "markdown-it";
import { type SlideEnv } from "./MetaParser";

/**
 * トークンツリーを走査し、ユーザー定義の変数（{% varName %} 形式）を動的に置換するクラス。
 */
export class VariableReplacer {
  private static readonly VARIABLE_REGEX = /\{%\s*([\w.-]+)\s*%\}/g;

  /**
   * 指定された文字列内の変数プレースホルダーを置換する。
   * @param text 対象文字列
   * @param env スライドの環境変数
   * @param pageNum 現在のページ番号
   */
  public static replaceString(
    text: string,
    env: SlideEnv,
    pageNum = 1,
  ): string {
    if (!text) return text;

    return text.replace(this.VARIABLE_REGEX, (match, key) => {
      const resolved = this.resolveValue(key, env, pageNum);
      return resolved !== null ? resolved : match;
    });
  }

  /**
   * markdown-it のコア・ルールに変数を走査・置換するフェーズを注入する。
   */
  public static inject(md: MarkdownIt): void {
    md.core.ruler.push("slide_variable_replacer", (state) => {
      const env = state.env as SlideEnv;
      if (!env) return;

      let currentPageNum = 1;

      for (const token of state.tokens) {
        if (token.type === "section_open") {
          const pageAttr = token.attrs?.find(([name]) => name === "data-page");
          if (pageAttr) {
            currentPageNum = parseInt(pageAttr[1], 10) || 1;
          }
        }

        this.replaceToken(token, env, currentPageNum);
      }
    });
  }

  /**
   * トークンとその子要素、および属性値に含まれる変数を再帰的に置換する。
   */
  private static replaceToken(
    token: any,
    env: SlideEnv,
    pageNum: number,
  ): void {
    if (typeof token.content === "string") {
      token.content = this.replaceString(token.content, env, pageNum);
    }

    if (token.attrs) {
      token.attrs = token.attrs.map(([name, value]: [string, string]) => [
        name,
        this.replaceString(value, env, pageNum),
      ]);
    }

    if (token.children) {
      for (const child of token.children) {
        this.replaceToken(child, env, pageNum);
      }
    }
  }

  /**
   * プレースホルダーに対応する変数の値を env から探索・解決する。
   */
  private static resolveValue(
    pathStr: string,
    env: SlideEnv,
    pageNum: number,
  ): string | null {
    if (pathStr === "page-number") {
      if (env.variables && "page-number" in env.variables) {
        return this.stringifyValue(env.variables["page-number"]);
      }
      return String(pageNum);
    }
    if (pathStr === "page-total") {
      return env.slideCount > 0 ? String(env.slideCount) : null;
    }

    if (env.variables && pathStr in env.variables) {
      return this.stringifyValue(env.variables[pathStr]);
    }

    const path = pathStr.split(".");
    let current: any = env.variables;

    for (const segment of path) {
      if (current == null || typeof current !== "object") {
        return null;
      }
      current = current[segment];
    }

    return current != null ? this.stringifyValue(current) : null;
  }

  /**
   * 取得した変数の値を適切な文字列に変換する。
   */
  private static stringifyValue(value: any): string {
    if (value == null) return "";

    if (typeof value === "object") {
      const flatten = (obj: any): string => {
        return Object.values(obj)
          .map((v) =>
            typeof v === "object" && v !== null ? flatten(v) : String(v),
          )
          .join(" ");
      };
      return flatten(value);
    }

    return String(value);
  }
}
