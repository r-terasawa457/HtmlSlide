import { join } from "path";

console.log(
  "\x1b[36m[Bun Build]\x1b[0m Starting compilation & HTML inline bundling...",
);

// 1. Bunによるアセットのビルドおよびコンパイルの実行
const buildResult = await Bun.build({
  entrypoints: ["./src/scripts/main.ts"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  format: "esm",
});

if (!buildResult.success) {
  console.error("❌ Build failed:", buildResult.logs);
  process.exit(1);
}

/**
 * 外部参照されているCSSおよびJSアセットを読み込み、HTMLテンプレート内へ安全にインライン化します。
 * * @param {string} htmlTemplate - 元のHTMLファイルのテキスト内容
 * @param {string} cssContent - インライン化するCSSのテキスト内容
 * @param {string} jsContent - インライン化するJavaScriptのテキスト内容
 * @returns {string} すべてのアセットが内包されたHTMLテキスト
 */
function inlineAssets(htmlTemplate, cssContent, jsContent) {
  const cssPattern = /<link[^>]*href=["']\/dist\/main\.css["'][^>]*\/?>/i;
  const jsPattern =
    /<script[^>]*src=["']\/dist\/main\.js["'][^>]*>([\s\S]*?<\/script>)?/i;

  return htmlTemplate
    .replace(cssPattern, () => {
      // 複雑な箇所への補足:
      // ミニファイされたコードに含まれる '$' を特殊な置換トークン（$& や $1 など）として
      // 誤評価させないため、文字列ではなく関数（コールバック）を返却する設計にしています。
      return `<style>${cssContent}</style>`;
    })
    .replace(jsPattern, () => {
      return `<script type="module">${jsContent}</script>`;
    });
}

// 2. インライン化された単一HTMLの生成および出力
try {
  const compiledJs = await Bun.file("./dist/main.js").text();
  const compiledCss = await Bun.file("./dist/main.css").text();
  const sourceHtml = await Bun.file("./index.html").text();

  const bundleHtml = inlineAssets(sourceHtml, compiledCss, compiledJs);

  await Bun.write("./dist/index.html", bundleHtml);

  console.log(
    "\x1b[32m[Bun Build] ✨ Success! Generated standalone asset at ./dist/index.html\x1b[0m",
  );
} catch (bundleError) {
  console.error("❌ HTML Bundling failed:", bundleError);
  process.exit(1);
}
