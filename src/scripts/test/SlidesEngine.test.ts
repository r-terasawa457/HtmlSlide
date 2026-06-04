import { describe, test, expect } from "bun:test";
import { SlidesEngine } from "../SlidesEngine";

describe("SlidesEngine - Basic Rendering & Structure", () => {
  test("should return empty slides container when input is empty", () => {
    const result = SlidesEngine.run("");
    expect(result.html).toBe('<div class="slides"></div>');
    expect(result.title).toBe("");
    expect(result.meta.variables).toEqual({});
  });

  test("should separate meta section and content correctly", () => {
    const md = `
:::title
My Awesome Presentation
:::

---

# Slide 1
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.title).toBe("My Awesome Presentation");
    expect(result.html).toContain('<section id="slide-1" class="page">');
    expect(result.html).toContain('<div class="content">');
    expect(result.html).toContain("<h1>Slide 1</h1>");
  });

  test("should fallback to whole text as content if no horizontal rule separator exists", () => {
    const md = "# Just Content\nNo meta section here.";
    const result = SlidesEngine.run(md);

    expect(result.meta.title).toBe("");
    expect(result.html).toContain("<h1>Just Content</h1>");
  });
});

describe("SlidesEngine - Meta Section Parsing", () => {
  test("should parse title, header, footer from colon blocks and HTML tags", () => {
    const md = `
:::title
Block Title
:::

<header>HTML Header</header>

<footer>HTML Footer</footer>

::::custom
:::var
Value
:::
::::

---

# Page
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.title).toBe("Block Title");
    expect(result.meta.header).toContain("HTML Header");
    expect(result.meta.footer).toContain("HTML Footer");
    expect(result.meta.variables).toEqual({ custom: { var: "Value" } });
  });

  test("should handle deep nested variables by staggering marker length", () => {
    const md = `
:::::theme
::::config
:::primary
#ff0000
:::
::::
:::::

---

# Page
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.meta.variables).toEqual({
      theme: {
        config: {
          primary: "#ff0000",
        },
      },
    });
  });
});

describe("SlidesEngine - Variable Replacement", () => {
  test("should resolve built-in page variables and custom variables", () => {
    const md = `
:::title
Slide Title
:::

:::username
Ryuki
:::

---

Title: {% meta.title %}
Author: {% username %}
Page: {% page-number %} / {% page-total %}

---

Page: {% page-number %} / {% page-total %}
`.trim();

    const result = SlidesEngine.run(md);

    expect(result.html).toContain("Title: Slide Title");
    expect(result.html).toContain("Author: Ryuki");
    expect(result.html).toContain("Page: 1 / 2");
    expect(result.html).toContain("Page: 2 / 2");
  });

  test("should leave unresolved variables as-is", () => {
    const md = `
---

Unresolved: {% non.existent.variable %}
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain("{% non.existent.variable %}");
  });
});

describe("SlidesEngine - Header/Footer Isolation Logic", () => {
  test("should auto-inject global header/footer if missing in a slide", () => {
    const md = `
:::header
Global Header
:::

:::footer
Global Footer
:::

---

# Slide 1
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain("Global Header");
    expect(result.html).toContain("Global Footer");
  });

  test("should NOT double-inject header/footer if slide has explicit header/footer", () => {
    const md = `
:::header
Global Header
:::

---

:::header
Custom Local Header
:::
# Slide 1
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain("Custom Local Header");
    expect(result.html).not.toContain("Global Header");
  });
});

describe("SlidesEngine - Styles and @import Asset Resolution", () => {
  test("should extract <style> from meta and resolve assets / back-matching", () => {
    const assets = {
      "styles/main.css": ".resolved-class { color: blue; }",
      "logo.png": "data:image/png;base64,abc",
    };

    const md = `
<style>
@import "./styles/main.css";
/* @import "ignored.css"; */
.local { surface: url('./logo.png'); }
</style>

---

# Content
`.trim();

    const result = SlidesEngine.run(md, assets);
    expect(result.html).toContain(".resolved-class { color: blue; }");
    expect(result.html).toContain('/* @import "ignored.css"; */');
  });
});

describe("ColonBlockPlugin (Custom Container)", () => {
  test("should parse single line notation with complex attributes", () => {
    const md = `
---

::alert class="warning" style="color: red;" data-id="123":: Short Alert Content
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain(
      '<alert class="warning" style="color: red;" data-id="123">',
    );
    expect(result.html).toContain("Short Alert Content</alert>");
  });

  test("should fallback to class attribute if no key is given in parameters", () => {
    const md = `
---

::note important visual-heavy:: Content
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain('<note class="important visual-heavy">');
  });

  test("should handle multi-line block syntax nested properly by changing marker length", () => {
    const md = `
---

::::card main-card
:::card-header card-header
Title
:::
Card Body
::::
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain('<card class="main-card">');
    expect(result.html).toContain('<card-header class="card-header">');
  });
});

describe("SlidesEngine - Code & Markdown Elements", () => {
  test("should highlight syntax via fenced code blocks", () => {
    const md = `
---

\`\`\`typescript
const a: number = 1;
\`\`\`
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain(
      '<pre><code class="hljs language-typescript">',
    );
    expect(result.html).toContain('<span class="hljs-attr">');
  });

  test("should parse image tokens, bind assets and extend classes", () => {
    const assets = {
      "assets/img/hero.jpg": "data:image/jpeg;base64,hero_data",
    };

    const md = `
---

![Hero Image class="rounded-lg" style="border: 1px;"](./assets/img/hero.jpg "Hero Title")
`.trim();

    const result = SlidesEngine.run(md, assets);
    expect(result.html).toContain(
      '<img src="data:image/jpeg;base64,hero_data"',
    );
    expect(result.html).toContain('class="Hero Image rounded-lg img-fluid"');
    expect(result.html).toContain('style="border: 1px;"');
    expect(result.html).toContain('alt="Hero Titleの画像"');
    expect(result.html).toContain('title="Hero Title"');
  });
});

describe("SlidesEngine - Advanced Edge Cases & Internal Specifications", () => {
  /**
   * 同じキーへの連続した代入は、配列化されず最後の値で上書きされる仕様をロック
   */
  test("should overwrite variable value when multiple values are assigned to the same key in meta section", () => {
    const md = `
:::::theme
::::colors
:::primary
- #ffffff
- #000000
:::
::::
:::::

---

Colors: {% theme.colors.primary %}
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain("Colors: #000000");
  });

  /**
   * @import 解決において、リモートURLが維持され、ローカルパスが後方一致で解決されるかを検証
   */
  test("should retain remote @import URLs and resolve local assets by suffix matching", () => {
    const assets = {
      "src/assets/css/theme.css": ".fallback { content: 'matched'; }",
    };

    const md = `
<style>
@import "https://example.com/external.css";
@import "theme.css";
</style>

---

# Content
`.trim();

    const result = SlidesEngine.run(md, assets);
    expect(result.html).toContain(
      '@import "https://example.com/external.css";',
    );
    expect(result.html).toContain(".fallback { content: 'matched'; }");
  });

  /**
   * 単一行のコロンブロックで、属性値内のエスケープクォートがHTMLエンティティ（&quot;）に変換される挙動をロック
   */
  test("should properly parse escaped quotes in single line colon block attributes and output as escaped HTML entities", () => {
    const md = `
---

::div data-msg="Hello \\"World\\"":: Content
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).toContain('data-msg="Hello &quot;World&quot;"');
  });

  /**
   * HTML閉じタグの直後に空行がない場合、メタデータの抽出に失敗してコンテンツが消失する制限事項をロック
   */
  test("should fail to extract header if no empty line follows HTML close tag (current limitation)", () => {
    const md = `
<header>Header Content</header>
# Slide Title Without Leading Empty Line

---

# Next Slide
`.trim();

    const result = SlidesEngine.run(md);
    expect(result.html).not.toContain("<header>Header Content</header>");
    expect(result.html).toContain("<h1>Next Slide</h1>");
  });
});
