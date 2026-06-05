import Token from "markdown-it/lib/token.mjs";
import StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import { load as loadYaml } from "js-yaml";
import { StyleProcessor } from "./StyleProcessor";

/**
 * スライド全体のパースおよびレンダリングに必要なコンテキスト情報。
 * 最初の区切り線より前に定義された共通コンポーネントやアセット、変数を保持します。
 */
export interface SlideEnv {
  /** スライドのグローバルタイトル */
  title?: string;
  /** 全ページ共通のヘッダートークン配列 */
  globalHeader?: Token[];
  /** 全ページ共通のフッタートークン配列 */
  globalFooter?: Token[];
  /** 解析・展開されたCSSスタイルの配列 */
  themeStyles: string[];
  /** ユーザー定義変数およびYAMLからパースされたメタデータ */
  variables: Record<string, any>;
  /** スライドの総ページ数 */
  slideCount: number;
  /** 外部から注入される画像などのアセット定義（パスとBase64のマップ） */
  assets?: Record<string, string>;
  /** 外部から注入されるビルトインテーマのCSS定義 */
  builtinThemes?: Record<string, string>;
}

/**
 * 最初のスライドが開始される前のメタセクションを走査し、
 * タイトル、共通ヘッダー/フッター、CSSスタイル、YAML変数を抽出して描画ストリームから分離するパーサー。
 */
export class MetaParser {
  /**
   * トークンストリームの冒頭からメタセクションを特定して各コンポーネントへ分類し、
   * メタセクションに属するトークンをストリームから完全に除去します。
   * * @param state - markdown-it のコア実行状態
   * @param env - スライドの環境変数コンテキスト
   */
  public static parse(state: StateCore, env: SlideEnv): void {
    const metaTokens: Token[] = [];
    const contentTokens: Token[] = [];
    let isMetaSection = true;

    for (const token of state.tokens) {
      if (isMetaSection && token.type === "hr") {
        isMetaSection = false;
        continue;
      }

      if (isMetaSection) {
        metaTokens.push(token);
      } else {
        contentTokens.push(token);
      }
    }

    if (isMetaSection) {
      return;
    }

    this.classifyMetaTokens(metaTokens, env);
    state.tokens = contentTokens;
  }

  /**
   * メタセクションから抽出されたトークン群を個々の役割（Style, YAML, Header/Footer/Title）に分類します。
   * * @param tokens - メタセクションに属するトークンの配列
   * @param env - スライドの環境変数コンテキスト
   */
  private static classifyMetaTokens(tokens: Token[], env: SlideEnv): void {
    const HEADER_REGEX = /^<header\b/i;
    const FOOTER_REGEX = /^<footer\b/i;
    const STYLE_REGEX = /^<style\b/i;

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];

      if (
        token?.type === "html_block" &&
        STYLE_REGEX.test(token.content.trim())
      ) {
        const innerCss = token.content
          .replace(/<style\b[^>]*>/i, "")
          .replace(/<\/style>/i, "");
        const processedCss = StyleProcessor.process(innerCss, env);
        env.themeStyles.push(processedCss);
        i++;
        continue;
      }

      if (token?.type === "fence" && token.info === "yaml") {
        try {
          const parsedYaml = loadYaml(token.content);
          if (typeof parsedYaml === "object" && parsedYaml !== null) {
            env.variables = { ...env.variables, ...parsedYaml };
          }
        } catch {
          // パース失敗時は状態を維持
        }
        i++;
        continue;
      }

      if (token?.type === "colon_block_open" && token.tag === "title") {
        const nextToken = tokens[i + 1];
        if (nextToken && nextToken.type === "inline") {
          env.title = nextToken.content.trim();
        }
        while (i < tokens.length) {
          const currentToken = tokens[i];
          if (currentToken && currentToken.type === "colon_block_close") {
            break;
          }
          i++;
        }
        i++;
        continue;
      }

      if (
        token?.type === "html_block" &&
        HEADER_REGEX.test(token.content.trim())
      ) {
        env.globalHeader = [token];
        i++;
        continue;
      }

      if (token?.type === "container_footer_open") {
        const footerTokens: Token[] = [];
        footerTokens.push(token);
        i++;

        while (i < tokens.length) {
          const currentToken = tokens[i];
          if (!currentToken) break;

          footerTokens.push(currentToken);
          i++;

          if (currentToken.type === "container_footer_close") {
            break;
          }
        }
        env.globalFooter = footerTokens;
        continue;
      }

      i++;
    }
  }
}
