import { describe, test, expect, beforeEach } from "bun:test";
import MarkdownIt from "markdown-it";
import { slideEnginePlugin } from "../index";
import { imageAssetPlugin } from "../ImageAssetPlugin";
import { type SlideEnv } from "../MetaParser";

/**
 * slideEnginePlugin および集約される各内部プラグインの統合動作を検証するテストスイート。
 */
describe("slideEnginePlugin", () => {
  let md: MarkdownIt;
  let env: SlideEnv;

  beforeEach(() => {
    md = new MarkdownIt({ html: true });
    md.use(slideEnginePlugin);
    env = {
      themeStyles: [],
      variables: {},
      slideCount: 0,
      assets: {},
    };
  });

  test("最初のhrより前をメタセクションとしてパースし、envへの格納とストリームからの除去が完全に行われること", () => {
    const src = [
      "```yaml",
      "author:",
      "  name: 'Ryuki Terasawa'",
      "```",
      "",
      "<style>",
      "section { background: #000; }",
      "</style>",
      "",
      "::title:: データベース特論",
      "",
      "<header>共通ヘッダー内容</header>",
      "",
      "---",
      "",
      "## ページ1の本文",
    ].join("\n");

    const html = md.render(src, env);

    expect(env.title).toBe("データベース特論");
    expect(env.variables).toEqual({ author: { name: "Ryuki Terasawa" } });
    expect(env.themeStyles[0]).toContain("section { background: #000; }");
    expect(env.slideCount).toBe(1);

    expect(html).not.toContain("```yaml");
    expect(html).not.toContain("::title::");
    expect(html).toContain('<section class="page" id="slide-1" data-page="1">');
    expect(html).toContain('<div class="content">');
    expect(html).toContain("<h2>ページ1の本文</h2>");
  });

  test("システム予約変数およびネストされたカスタム変数が、本文およびインライン子トークン内で漏れなく置換されること", () => {
    const src = [
      "```yaml",
      "meta:",
      "  info:",
      "    topic: 'Slide QA'",
      "```",
      "",
      "---",
      "",
      "## トピック: {% meta.info.topic %}",
      "",
      "スライド番号: {% page-number %} / {% page-total %}",
      "",
      "---",
      "",
      "## ページ2",
    ].join("\n");

    const html = md.render(src, env);

    expect(env.slideCount).toBe(2);
    expect(html).toContain("<h2>トピック: Slide QA</h2>");
    expect(html).toContain("スライド番号: 1 / 2");
    expect(html).toContain('id="slide-2"');
  });

  test("HTML要素の属性値に含まれる変数プレースホルダーも動的に置換されること", () => {
    const src = [
      "```yaml",
      "themeClass: 'dark-mode'",
      "```",
      "",
      "---",
      "",
      '<div class="{% themeClass %}">カスタムコンポーネント</div>',
    ].join("\n");

    const html = md.render(src, env);

    expect(html).toContain(
      '<div class="dark-mode">カスタムコンポーネント</div>',
    );
  });

  test("グローバルヘッダーが全ページに波及し、個別定義があるページでは固有ヘッダーが優先（オーバーライド）されること", () => {
    const src = [
      "<header>グローバル共通</header>",
      "",
      "---",
      "",
      "## ページ1",
      "",
      "---",
      "",
      "<header>個別優先ヘッダー</header>",
      "",
      "## ページ2",
    ].join("\n");

    const html = md.render(src, env);

    expect(html).toContain(
      '<section class="page" id="slide-1" data-page="1">\n<header>グローバル共通</header>\n<div class="content">',
    );

    expect(html).toContain(
      '<section class="page" id="slide-2" data-page="2">\n<header>個別優先ヘッダー</header>\n<div class="content">',
    );
  });

  test("メタセクション（最初のhr）を欠くMarkdownが入力された場合、フォールバックして単一ページのスライド構造を出力すること", () => {
    const src = [
      "## メタデータのないスライド",
      "通常のレンダリングを維持しつつ、最低限のスライド構造にラップされます。",
    ].join("\n");

    const html = md.render(src, env);

    expect(env.slideCount).toBe(1);
    expect(html).toContain('<section class="page" id="slide-1" data-page="1">');
    expect(html).toContain('<div class="content">');
    expect(html).toContain("<h2>メタデータのないスライド</h2>");
  });

  test("空の文字列、または不正なYAMLが渡された場合でも、致命的なランタイムエラーを起こさず安全に処理を継続すること", () => {
    const src = [
      "```yaml",
      "author: [未閉じのブラケット",
      "```",
      "",
      "---",
      "",
      "## 構文エラーのテスト",
    ].join("\n");

    const html = md.render(src, env);

    expect(env.variables).toEqual({});
    expect(html).toContain("<h2>構文エラーのテスト</h2>");
  });
});

/**
 * imageAssetPlugin 単体における画像パスの置換、属性解析、およびフォールバックの挙動を検証するテストスイート。
 */
describe("imageAssetPlugin", () => {
  let md: MarkdownIt;
  let env: SlideEnv;

  beforeEach(() => {
    md = new MarkdownIt({ html: true });
    md.use(imageAssetPlugin);
    env = {
      themeStyles: [],
      variables: {},
      slideCount: 0,
      assets: {
        "assets/images/logo.png": "data:image/png;base64,LOGO_DATA",
        "diagram.svg": "data:image/svg+xml;base64,DIAGRAM_DATA",
      },
    };
  });

  test("定義されたアセットのパスと完全一致する場合に Base64 データURL へ置換されること", () => {
    const src = '![m-4]("assets/images/logo.png" "システムロゴ")';
    const html = md.render(src, env);

    expect(html).toContain('src="data:image/png;base64,LOGO_DATA"');
    expect(html).toContain('class="m-4 img-fluid"');
    expect(html).toContain('alt="システムロゴの画像"');
  });

  test("相対パスのプレフィックスが存在する場合でも後方一致でアセットが解決されること", () => {
    const src = "![m-4](../diagram.svg)";
    const html = md.render(src, env);

    expect(html).toContain('src="data:image/svg+xml;base64,DIAGRAM_DATA"');
  });

  test("title 属性が指定されている場合に alt 属性および title 属性の文字列が正しく構成されること", () => {
    const src = '![m-4](assets/images/logo.png "システムロゴ")';
    const html = md.render(src, env);

    expect(html).toContain('alt="システムロゴの画像"');
    expect(html).toContain('title="システムロゴ"');
  });

  test("alt テキスト内にインラインの属性定義(class, style)が含まれる場合に正しくパースされHTML属性へ展開されること", () => {
    const src = '![custom-class style="margin: 10px;"](assets/images/logo.png)';
    const html = md.render(src, env);

    expect(html).toContain('class="custom-class img-fluid"');
    expect(html).toContain('style="margin: 10px;"');
  });
});
