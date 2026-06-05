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
    expect(state.tokens[2]).toBe(headerToken);
    expect(state.tokens[3].type).toBe("div_open");
    expect(state.tokens[4]).toBe(pOpen);
    expect(state.tokens[5]).toBe(pClose);
    expect(state.tokens[6].type).toBe("div_close");
    expect(state.tokens[7]).toBe(footerToken);
    expect(state.tokens[8].type).toBe("section_close");
  });
});
