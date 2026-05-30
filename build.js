import { join } from "path";

console.log(
  "\x1b[36m[Bun Build]\x1b[0m Starting compilation & HTML multi-entry bundling...",
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

  // 3. presenter.html の組み立て（CSSとJSの完全内包化）
  const bundledPresenterHtml = presenterTemplate
    .replace("/* BUILD_INJECT_STYLES */", () => compiledCss)
    .replace("/* BUILD_INJECT_SCRIPT */", () => compiledPresenterJs);

  // 4. main.js の内部にあるプレースホルダーへ、組み立てたプレゼンターHTMLを文字列として安全に置換・インジェクション
  // 💡 複雑な箇所への補足:
  // ミニファイコード内の特殊文字やエスケープの破壊を防ぐため、文字列関数コールバックを使い、
  // バッククォートやドル記号を事前にサニタイズして安全に流し込みます。
  compiledMainJs = compiledMainJs.replace("__PRESENTER_HTML_STRING__", () => {
    return bundledPresenterHtml
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`")
      .replace(/\$/g, "\\$");
  });

  // 5. index.html へのメインアセットのインライン結合
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
    "\x1b[32m[Bun Build] ✨ Success! Perfectly bundled files into: ./dist/index.html\x1b[0m",
  );
} catch (bundleError) {
  console.error("❌ HTML Bundling failed:", bundleError);
  process.exit(1);
}
