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

// 2.2. PPTXエクスポート側スクリプトのコンパイル
const pptxExportBuildResult = await Bun.build({
  entrypoints: ["./src/scripts/pptxExport.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  format: "esm",
});

if (!pptxExportBuildResult.success) {
  console.error("❌ PPTX Export Build failed:", pptxExportBuildResult.logs);
  process.exit(1);
}

try {
  let compiledMainJs = await Bun.file("./dist/main.js").text();
  const compiledPresenterJs = await Bun.file("./dist/presenter.js").text();
  const compiledPptxExportJs = await Bun.file("./dist/pptxExport.js").text();
  const compiledCss = await Bun.file("./dist/main.css").text();
  const sourceHtml = await Bun.file("./index.html").text();
  const viewerTemplate = await Bun.file("./src/viewer.html").text();
  const presenterTemplate = await Bun.file("./src/presenter.html").text();
  const pptxExportTemplate = await Bun.file("./src/pptx_export.html").text();

  // 6. EmbeddedAssets オブジェクトを構築
  const EmbeddedAssets = {
    "src/viewer.html": viewerTemplate,
    "src/presenter.html": presenterTemplate,
    "src/pptx_export.html": pptxExportTemplate,
    "dist/presenter.js": compiledPresenterJs,
    "dist/pptxExport.js": compiledPptxExportJs,
    "src/css/presenter.css": await Bun.file("./src/css/presenter.css").text(),
    "src/css/slide_root.css": await Bun.file("./src/css/slide_root.css").text(),
    "themes/css/bootstrap.min.css": await Bun.file(
      "./static/css/bootstrap.min.css",
    ).text(),
    "themes/css/vs.css": await Bun.file("./src/theme/vs.css").text(),
    "themes/slide-thema-default.css": await Bun.file(
      "./src/theme/slide-thema-default.css",
    ).text(),
  };

  const jsonStr = JSON.stringify(EmbeddedAssets);

  // compiledMainJs の先頭に EmbeddedAssets を定義して流し込む
  compiledMainJs = `globalThis.EmbeddedAssets = ${jsonStr};\n` + compiledMainJs;
  // HTMLパースを崩壊させないよう、すべてのHTML閉じタグを安全にエスケープして埋め込む
  compiledMainJs = compiledMainJs.replace(/<\/([a-zA-Z]+)>/gi, "<\\/$1>");

  // 6. index.html へのメインアセットのインライン結合
  function inlineAssets(htmlTemplate, cssContent, jsContent) {
    const cssPattern = /<link[^>]*href=["']\/dist\/main\.css["'][^>]*\/?>/i;
    const jsPattern =
      /<script[^>]*src=["']\/dist\/main\.js["'][^>]*>([\s\S]*?<\/script>)?/i;

    return htmlTemplate
      .replace(cssPattern, () => "<style>" + cssContent + "</style>")
      .replace(
        jsPattern,
        () => '<script type="module">' + jsContent + "</script>",
      );
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
