import Token from "markdown-it/lib/token.mjs";
import StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import { load as loadYaml } from "js-yaml";
import { StyleProcessor } from "./StyleProcessor";

/**
 * スライド全体のパースおよびレンダリングに必要なコンテキスト情報。
 * 最初の区切り線より前に定義された共通コンポーネントやアセット、変数を保持する。
 */
export interface SlideEnv {
  title?: string;
  globalHeader?: Token[];
  globalFooter?: Token[];
  themeStyles: string[];
  variables: Record<string, any>;
  slideCount: number;

  // 外部から注入されるアセットとテーマの定義
  assets?: Record<string, string>;
  builtinThemes?: Record<string, string>;
}

/**
 * 最初のスライドが開始される前（最初の hr トークンの前）のメタセクションを走査し、
 * タイトル、共通ヘッダー/フッター、CSSスタイル、YAML変数を抽出して描画ストリームから分離するパーサー。
 */
export class MetaParser {
  /**
   * トークンストリームの冒頭からメタセクションを特定し、各コンポーネントへ分類した上で、
   * メタセクションに属するトークンをストリームから完全に除去する。
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

    // メタセクションが存在しない（hrで区切られていない）場合は処理をスキップ
    if (isMetaSection) {
      return;
    }

    this.classifyMetaTokens(metaTokens, env);
    state.tokens = contentTokens;
  }

  /**
   * メタセクションから抽出されたトークン群を個々の役割（Style, YAML, Header/Footer/Title）に分類する。
   */
  private static classifyMetaTokens(tokens: Token[], env: SlideEnv): void {
    // タグ判定用の正規表現
    const HEADER_REGEX = /^<header\b/i;
    const FOOTER_REGEX = /^<footer\b/i;
    const STYLE_REGEX = /^<style\b/i;

    let i = 0;
    while (i < tokens.length) {
      const token = tokens[i];

      // 1. スタイルシート（<style>）の抽出
      if (
        token?.type === "html_block" &&
        STYLE_REGEX.test(token.content.trim())
      ) {
        const processedCss = StyleProcessor.process(token.content, env);
        env.themeStyles.push(processedCss);
        i++;
        continue;
      }

      // 2. YAMLブロックによるカスタム変数の抽出
      if (token?.type === "fence" && token.info === "yaml") {
        try {
          const parsedYaml = loadYaml(token.content);
          if (typeof parsedYaml === "object" && parsedYaml !== null) {
            env.variables = { ...env.variables, ...parsedYaml };
          }
        } catch (e) {
          // YAMLのパースエラー時は、不正なパッチ当てを防ぐため元のコンテンツを維持するか警告ログに留める
        }
        i++;
        continue;
      }

      // 3. ColonBlock によるタイトルの抽出 (例: ::title:: ...)
      if (token?.type === "colon_block" && token.info === "title") {
        env.title = token.content;
        i++;
        continue;
      }

      // 4. 共通ヘッダー・フッターの抽出（コンテナブロックのペアをトークンごと退避）
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
