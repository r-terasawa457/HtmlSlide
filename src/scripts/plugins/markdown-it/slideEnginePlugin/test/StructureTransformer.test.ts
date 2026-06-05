import { describe, test, expect } from "bun:test";
import Token from "markdown-it/lib/token.mjs";
import { StructureTransformer } from "../StructureTransformer";
import { type SlideEnv } from "../MetaParser";

/**
 * StructureTransformerクラスによるスライド構造化およびトップレベルパーツの配置ロジックを検証するテストスイート。
 */
describe("StructureTransformer", () => {
  /**
   * フラットなトークン配列がhrを境界に分割され、セクションおよびコンテンツコンテナでカプセル化されることを検証する。
   */
  test("should split tokens by hr and wrap each page with section and div.content", () => {
    const env: SlideEnv = { variables: {}, themeStyles: [], slideCount: 0 };

    const tokens = [
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
      new Token("hr", "hr", 0),
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
    ];
    const state = { tokens, Token: Token } as any;

    StructureTransformer.transform(state, env);

    expect(env.slideCount).toBe(2);
    expect(state.tokens[0].type).toBe("section_open");
    expect(state.tokens[0].attrs).toContainEqual(["data-page", "1"]);
    expect(state.tokens[1].type).toBe("div_open");
    expect(state.tokens[1].attrs).toContainEqual(["class", "content"]);
  });

  /**
   * ページ内のトップレベルにあるヘッダーおよびフッターのみが抽出され、
   * コンテンツ領域（div.content）の外側かつセクション内の正しい順序に配置されることを検証する。
   */
  test("should extract top-level header and footer, and place them outside of content", () => {
    const env: SlideEnv = { variables: {}, themeStyles: [], slideCount: 0 };

    const headerToken = new Token("html_block", "", 0);
    headerToken.content = "<header>Page Header</header>";

    const pOpen = new Token("paragraph_open", "p", 1);
    const pClose = new Token("paragraph_close", "p", -1);

    const footerToken = new Token("html_block", "", 0);
    footerToken.content = '<footer class="low">Page Footer</footer>';

    const pageStyleToken = new Token("html_block", "", 0);
    pageStyleToken.content = "<style>.page-only { color: red; }</style>";

    const state = {
      tokens: [headerToken, pageStyleToken, pOpen, pClose, footerToken],
      Token: Token,
    } as any;

    StructureTransformer.transform(state, env);

    expect(state.tokens[0].type).toBe("section_open");
    // pageStyleToken should be extracted and placed at index 1 (the very top of the page elements, before header)
    expect(state.tokens[1]).toBe(pageStyleToken);
    expect(state.tokens[1].content).toBe(
      "<style>@scope{.page-only{color:red;}}</style>",
    );
    expect(state.tokens[2]).toBe(headerToken);
    expect(state.tokens[3].type).toBe("div_open");
    expect(state.tokens[4]).toBe(pOpen);
    expect(state.tokens[5]).toBe(pClose);
    expect(state.tokens[6].type).toBe("div_close");
    expect(state.tokens[7]).toBe(footerToken);
    expect(state.tokens[8].type).toBe("section_close");
  });

  /**
   * ページ個別の <style> 内のCSSがすでに @scope で囲まれている場合、二重に囲まないことを検証する。
   */
  test("should not wrap page-specific styles with @scope if already starting with @scope", () => {
    const env: SlideEnv = { variables: {}, themeStyles: [], slideCount: 0 };

    const pageStyleToken = new Token("html_block", "", 0);
    pageStyleToken.content =
      "<style>@scope { .page-only { color: red; } }</style>";

    const state = {
      tokens: [pageStyleToken],
      Token: Token,
    } as any;

    StructureTransformer.transform(state, env);

    expect(state.tokens[1]).toBe(pageStyleToken);
    expect(state.tokens[1].content).toBe(
      "<style>@scope{.page-only{color:red;}}</style>",
    );
  });

  /**
   * env.themeStylesに格納されたグローバルスタイルが、全体の最先頭に<style>トークンとしてインジェクションされ、
   * @scopeで囲まれていない場合は自動的に囲まれることを検証する。
   */
  test("should prepend style block at the very beginning of the overall token stream and apply @scope if not present", () => {
    const env: SlideEnv = {
      variables: {},
      themeStyles: [".test { color: blue; }"],
      slideCount: 0,
    };

    const tokens = [
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
    ];
    const state = { tokens, Token: Token } as any;

    StructureTransformer.transform(state, env);

    expect(state.tokens[0].type).toBe("html_block");
    expect(state.tokens[0].content).toBe(
      "<style>@scope {\n.test { color: blue; }\n}</style>",
    );
  });

  /**
   * すでに@scopeで開始されている場合は、二重に@scopeで囲まないことを検証する。
   */
  test("should not wrap styles with @scope if already starting with @scope", () => {
    const env: SlideEnv = {
      variables: {},
      themeStyles: ["@scope { .test { color: blue; } }"],
      slideCount: 0,
    };

    const tokens = [
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
    ];
    const state = { tokens, Token: Token } as any;

    StructureTransformer.transform(state, env);

    expect(state.tokens[0].type).toBe("html_block");
    expect(state.tokens[0].content).toBe(
      "<style>@scope { .test { color: blue; } }</style>",
    );
  });

  /**
   * token.level === 0 の hr トークンでのみページ分割が行われることを検証する。
   */
  test("should only split pages by hr when token.level is 0", () => {
    const env: SlideEnv = { variables: {}, themeStyles: [], slideCount: 0 };

    const hrLevel1 = new Token("hr", "hr", 0);
    hrLevel1.level = 1; // ネストされた要素内などの設定

    const hrLevel0 = new Token("hr", "hr", 0);
    hrLevel0.level = 0; // ルート直下の設定

    const tokens = [
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
      hrLevel1,
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
      hrLevel0,
      new Token("paragraph_open", "p", 1),
      new Token("paragraph_close", "p", -1),
    ];
    const state = { tokens, Token: Token } as any;

    StructureTransformer.transform(state, env);

    expect(env.slideCount).toBe(2); // level 0 の hr でのみ分割され、結果は2ページになる
  });
});
