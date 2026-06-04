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
});
