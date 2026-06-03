import MarkdownIt from "markdown-it";
import { SlideEnv } from "./MetaParser";

/**
 * レンダリング直前のHTMLテキスト、またはテキストノードに対して
 * ユーザーが定義した変数（{% varName %} 形式）を動的にマッピング・置換するデリゲート。
 * トークンツリーの破壊的操作を避け、出力フェーズでの文字列置換を保証する。
 */
export class VariableReplacer {
  private static readonly VARIABLE_REGEX = /\{%\s*([\w.-]+)\s*%\}/g;

  /**
   * 対象テキスト内に存在する変数を、envに格納されている定義に基づいてすべて置換する。
   * 定義されていない変数の場合は、元のプレースホルダー文字列をそのまま維持する。
   */
  public static replace(text: string, env: SlideEnv): string {
    if (!text || !env.variables) {
      return text;
    }

    return text.replace(this.VARIABLE_REGEX, (match, key) => {
      return key in env.variables ? env.variables[key] : match;
    });
  }

  /**
   * markdown-itのテキストおよびインラインレンダラーに対して変数置換フックを注入する。
   */
  public static inject(md: MarkdownIt): void {
    const defaultTextRenderer =
      md.renderer.rules.text ||
      ((tokens, idx, options, env, self) =>
        self.renderToken(tokens, idx, options));

    md.renderer.rules.text = (tokens, idx, options, env: SlideEnv, self) => {
      const renderedHtml = defaultTextRenderer(tokens, idx, options, env, self);
      return this.replace(renderedHtml, env);
    };

    const defaultCodeInline =
      md.renderer.rules.code_inline ||
      ((tokens, idx, options, env, self) =>
        self.renderToken(tokens, idx, options));

    md.renderer.rules.code_inline = (
      tokens,
      idx,
      options,
      env: SlideEnv,
      self,
    ) => {
      const renderedHtml = defaultCodeInline(tokens, idx, options, env, self);
      return this.replace(renderedHtml, env);
    };
  }
}
