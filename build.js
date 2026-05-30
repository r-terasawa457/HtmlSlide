import { join } from "path";

console.log(
  "\x1b[36m[Bun Build]\x1b[0m Starting compilation & Base64 encapsulated bundling...",
);

// 1. プレゼンター側スクリプトの単独コンパイル
const presenterBuildResult = await Bun.build({
  entrypoints: ["./src/scripts/presenter.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  format: "esm",
});

if (!presenterBuildResult.success) {
  console.error("❌ Presenter Build failed:", presenterBuildResult.logs);
  process.exit(1);
}

// 2. ビューアー側（メイン）スクリプトのコンパイル
const mainBuildResult = await Bun.build({
  entrypoints: ["./src/scripts/main.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  format: "esm",
});

if (!mainBuildResult.success) {
  console.error("❌ Main Build failed:", mainBuildResult.logs);
  process.exit(1);
}

try {
  let compiledMainJs = await Bun.file("./dist/main.js").text();
  const compiledPresenterJs = await Bun.file("./dist/presenter.js").text();
  const compiledCss = await Bun.file("./dist/main.css").text();
  const sourceHtml = await Bun.file("./index.html").text();
  const presenterTemplate = await Bun.file("./src/presenter.html").text();

  // 2.5. slides.cssの@import依存を静的ファイル内容で完全埋め込み
  let slidesCss = await Bun.file("./src/css/slides.css").text();
  const bootstrapCss = await Bun.file("./static/bootstrap.min.css").text();
  const vsCss = await Bun.file("./static/vs.css").text();

  slidesCss = slidesCss
    .replace(/@import\s+['"]\/bootstrap\.min\.css['"];?/gi, () => bootstrapCss)
    .replace(/@import\s+['"]\/vs\.css['"];?/gi, () => vsCss);

  // compiledMainJsのプレースホルダーをインライン展開されたslidesCssに置換
  const escapedSlidesCss = slidesCss
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");

  compiledMainJs = compiledMainJs.replace(
    "__SLIDES_CSS_PLACEHOLDER__",
    () => escapedSlidesCss,
  );

  // 3. presenter.html の組み立て（CSSとJSの完全内包化）
  const bundledPresenterHtml = presenterTemplate
    .replace("/* BUILD_INJECT_STYLES */", () => compiledCss)
    .replace("/* BUILD_INJECT_SCRIPT */", () => compiledPresenterJs);

  // 4. 💡 組み立てたHTMLドキュメント全体を安全なBase64文字列に変換
  const base64PresenterHtml = Buffer.from(
    bundledPresenterHtml,
    "utf-8",
  ).toString("base64");

  // 5. main.js の内部にあるプレースホルダーをBase64文字列で置換
  // Base64文字セットは [A-Za-z0-9+/=] のみのため、置換用マクロ文字（$など）の誤評価リスクが完全にゼロになります。
  compiledMainJs = compiledMainJs.replace(
    "__PRESENTER_DATA_PLACEHOLDER__",
    () => base64PresenterHtml,
  );

  // 6. index.html へのメインアセットのインライン結合
  function inlineAssets(htmlTemplate, cssContent, jsContent) {
    const cssPattern = /<link[^>]*href=["']\/dist\/main\.css["'][^>]*\/?>/i;
    const jsPattern =
      /<script[^>]*src=["']\/dist\/main\.js["'][^>]*>([\s\S]*?<\/script>)?/i;

    return htmlTemplate
      .replace(cssPattern, () => `<style>${cssContent}</style>`)
      .replace(jsPattern, () => `<script type="module">${jsContent}</script>`);
  }

  const bundleHtml = inlineAssets(sourceHtml, compiledCss, compiledMainJs);

  // 最終成果物をスタンドアロン出力
  await Bun.write("./dist/index.html", bundleHtml);

  console.log(
    "\x1b[32m[Bun Build] ✨ Success! stand-alone single file generated at: ./dist/index.html\x1b[0m",
  );
} catch (bundleError) {
  console.error("❌ HTML Bundling failed:", bundleError);
  process.exit(1);
}
