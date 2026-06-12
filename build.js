import { join } from "path";
import { Glob } from "bun";

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
  /** @type {Record<string, string>} 埋め込みアセットのキーとローカルパスのマッピング定義 */
  const assetMapping = {
    "src/viewer.html": "./src/viewer.html",
    "src/presenter.html": "./src/presenter.html",
    "src/pptx_export.html": "./src/pptx_export.html",
    "dist/presenter.js": "./dist/presenter.js",
    "dist/pptxExport.js": "./dist/pptxExport.js",
    "src/css/presenter.css": "./src/css/presenter.css",
    "src/css/slide_root.css": "./src/css/slide_root.css",
  };

  // テーマディレクトリ内の全CSSファイルを自動検知してマッピングに追加
  const glob = new Glob("**/*.css");
  const themeFiles = Array.from(glob.scanSync({ cwd: "./src/theme" }));
  const themeListStr = JSON.stringify(themeFiles);

  for (const file of themeFiles) {
    assetMapping[`themes/${file}`] = `./src/theme/${file}`;
  }

  // 定義したマッピングとインライン用コアファイルを並列に一括読み込み
  const assetKeys = Object.keys(assetMapping);
  const assetPromises = assetKeys.map((key) =>
    Bun.file(assetMapping[key]).text(),
  );
  const coreFilesPromises = [
    Bun.file("./dist/main.js").text(),
    Bun.file("./dist/main.css").text(),
    Bun.file("./index.html").text(),
  ];

  const [assetContents, [compiledMainJsSrc, compiledCss, sourceHtml]] =
    await Promise.all([
      Promise.all(assetPromises),
      Promise.all(coreFilesPromises),
    ]);

  // 読み込んだリソースから EmbeddedAssets オブジェクトを動的に生成
  const EmbeddedAssets = {};
  assetKeys.forEach((key, index) => {
    EmbeddedAssets[key] = assetContents[index];
  });

  const jsonStr = JSON.stringify(EmbeddedAssets);
  let compiledMainJs =
    `globalThis.BuiltinThemesList = ${themeListStr};\nglobalThis.EmbeddedAssets = ${jsonStr};\n` +
    compiledMainJsSrc;
  compiledMainJs = compiledMainJs.replace(/<\/([a-zA-Z]+)>/gi, "<\\/$1>");

  /**
   * HTML テンプレートに CSS と JavaScript をインライン展開する
   */
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

  await Bun.write("./dist/index.html", bundleHtml);

  console.log(
    "\x1b[32m[Bun Build] ✨ Success! stand-alone single file generated at: ./dist/index.html\x1b[0m",
  );
} catch (bundleError) {
  console.error("❌ HTML Bundling failed:", bundleError);
  process.exit(1);
}
