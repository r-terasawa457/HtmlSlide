import { describe, test, expect } from "bun:test";
import MarkdownIt from "markdown-it";
import { VariableReplacer } from "../VariableReplacer";
import { type SlideEnv } from "../MetaParser";

/**
 * VariableReplacerクラスによるテキストおよびHTML内の動的変数置換機能を検証するテストスイート。
 */
describe("VariableReplacer", () => {
  /**
   * 定義済みの変数が正しく置換され、未定義の変数がそのまま出力に残留することを検証する。
   */
  test("should replace registered variables and leave unregistered variables untouched", () => {
    const env: SlideEnv = {
      variables: { "author.name.first": "tarou", "page-number": "5" },
      themeStyles: [],
      slideCount: 10,
    };

    const text =
      "Author: {% author.name.first %}, Page: {% page-number %}/{% page-total %}";
    const result = VariableReplacer.replaceString(text, env, 5);

    expect(result).toBe("Author: tarou, Page: 5/10");
  });

  /**
   * markdown-itインスタンスへのインジェクション後、レンダリングフェーズで
   * トークン内の変数が自動的に置換されることを検証する。
   */
  test("should integrate with markdown-it renderer to replace variables during html generation", () => {
    const md = new MarkdownIt();
    VariableReplacer.inject(md);

    const env: SlideEnv = {
      variables: { title: "Database Lecture" },
      themeStyles: [],
      slideCount: 0,
    };

    const html = md.render("Welcome to {% title %}", env);
    expect(html).toContain("Welcome to Database Lecture");
  });
});
