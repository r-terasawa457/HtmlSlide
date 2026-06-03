import { describe, test, expect } from "bun:test";
import Token from "markdown-it/lib/token.mjs";
import { MetaParser, type SlideEnv } from "../MetaParser";

/**
 * MetaParserクラスのメタデータ抽出およびトークンフィルタリング機能を検証するテストスイート。
 */
describe("MetaParser", () => {
  /**
   * 最初の区切り線（hr）より前に配置されたYAML、スタイル、カスタムブロックが
   * 正しくSlideEnvに分類され、トークンストリームから除外されることを検証する。
   */
  test("should extract YAML metadata, styles, and global templates, then filter them out from tokens", () => {
    const env: SlideEnv = {
      variables: {},
      themeStyles: [],
      slideCount: 0,
    };

    const yamlToken = new Token("fence", "code", 0);
    yamlToken.info = "yaml";
    yamlToken.content = "author:\n  name: tarou\ngender: man";

    const styleToken = new Token("html_block", "", 0);
    styleToken.content = '<style>\n@import "css/vs.css";\n</style>';

    const hrToken = new Token("hr", "hr", 0);
    const contentToken = new Token("paragraph_open", "p", 1);

    const state = {
      tokens: [yamlToken, styleToken, hrToken, contentToken],
    } as any;

    MetaParser.parse(state, env);

    expect(env.variables).toEqual({ author: { name: "tarou" }, gender: "man" });
    expect(env.themeStyles).toContain(
      '<style>\n@import "css/vs.css";\n</style>',
    );
    expect(state.tokens.length).toBe(1);
    expect(state.tokens[0].type).toBe("paragraph_open");
  });
});
