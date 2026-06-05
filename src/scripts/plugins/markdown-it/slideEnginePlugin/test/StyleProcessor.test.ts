import { describe, test, expect } from "bun:test";
import { StyleProcessor } from "../StyleProcessor";
import { type SlideEnv } from "../MetaParser";

/**
 * StyleProcessorクラスによるCSSの@importルール解決機能を検証するテストスイート。
 */
describe("StyleProcessor", () => {
  const mockEnv: SlideEnv = {
    themeStyles: [],
    variables: {},
    slideCount: 0,
    assets: {
      "css/bootstrap.min.css": "/* bootstrap css content */",
      "css/vs.css": "/* vs code theme css content */",
      "themedir/slide-theme-custom.css": "/* custom theme content */",
    },
    builtinThemes: {
      "slide-theme-default.css": "/* builtin default theme content */",
    },
  };

  test("should resolve exact or clean relative path from assets", () => {
    const rawCss = `@import "./css/vs.css";\n@import "css/bootstrap.min.css";`;
    const result = StyleProcessor.process(rawCss, mockEnv);

    expect(result).toContain("/* vs code theme css content */");
    expect(result).toContain("/* bootstrap css content */");
  });

  test("should resolve path from assets using suffix matching", () => {
    const rawCss = `@import "slide-theme-custom.css";`;
    const result = StyleProcessor.process(rawCss, mockEnv);

    expect(result).toBe("/* custom theme content */");
  });

  test("should resolve path from builtin themes when assets do not match", () => {
    const rawCss = `@import "slide-theme-default.css";`;
    const result = StyleProcessor.process(rawCss, mockEnv);

    expect(result).toBe("/* builtin default theme content */");
  });

  test("should ignore @import rules inside css comments", () => {
    const rawCss = `/* @import "css/vs.css"; */\n/*\n * @import "css/bootstrap.min.css";\n */`;
    const result = StyleProcessor.process(rawCss, mockEnv);

    expect(result).toContain('@import "css/vs.css"');
    expect(result).toContain('@import "css/bootstrap.min.css"');
  });

  test("should ignore external remote URLs", () => {
    const rawCss = `@import "https://example.com/styles.css";\n@import "http://fonts.googleapis.com/css?family=Open+Sans";`;
    const result = StyleProcessor.process(rawCss, mockEnv);

    expect(result).toContain('@import "https://example.com/styles.css";');
    expect(result).toContain(
      '@import "http://fonts.googleapis.com/css?family=Open+Sans";',
    );
  });

  test("should leave the import rule untouched if no asset or theme matches", () => {
    const rawCss = `@import "css/unknown-file.css";`;
    const result = StyleProcessor.process(rawCss, mockEnv);

    expect(result).toBe(`@import "css/unknown-file.css";`);
  });

  test("should recursively resolve nested @import rules (A -> B -> C)", () => {
    const envWithNested: SlideEnv = {
      themeStyles: [],
      variables: {},
      slideCount: 0,
      builtinThemes: {
        "theme-a.css": `@import "theme-b.css";\n/* Body of A */`,
        "theme-b.css": `@import "theme-c.css";\n/* Body of B */`,
        "theme-c.css": `/* Body of C */`,
      },
    };

    const rawCss = `@import "theme-a.css";`;
    const result = StyleProcessor.process(rawCss, envWithNested);

    expect(result).toContain("/* Body of C */");
    expect(result).toContain("/* Body of B */");
    expect(result).toContain("/* Body of A */");
  });

  test("should prevent infinite loops from circular @import rules (A -> B -> A)", () => {
    const envWithCircular: SlideEnv = {
      themeStyles: [],
      variables: {},
      slideCount: 0,
      builtinThemes: {
        "theme-a.css": `@import "theme-b.css";\n/* Body of A */`,
        "theme-b.css": `@import "theme-a.css";\n/* Body of B */`,
      },
    };

    const rawCss = `@import "theme-a.css";`;
    // If it handles circular loops correctly, it won't crash with Stack Overflow
    const result = StyleProcessor.process(rawCss, envWithCircular);

    // The second theme-a.css import in theme-b should be skipped/ignored (empty string)
    expect(result).toContain("/* Body of B */");
    expect(result).toContain("/* Body of A */");
  });

  test("should eliminate duplicate imports of the same file (A imports B and C, both B and C import D)", () => {
    const envWithDuplicates: SlideEnv = {
      themeStyles: [],
      variables: {},
      slideCount: 0,
      builtinThemes: {
        "theme-a.css": `@import "theme-b.css";\n@import "theme-c.css";`,
        "theme-b.css": `@import "theme-d.css";\n/* Body of B */`,
        "theme-c.css": `@import "theme-d.css";\n/* Body of C */`,
        "theme-d.css": `/* Body of D */`,
      },
    };

    const rawCss = `@import "theme-a.css";`;
    const result = StyleProcessor.process(rawCss, envWithDuplicates);

    // Body of D should appear exactly once
    const matches = result.match(/\/\* Body of D \*\//g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });
});
