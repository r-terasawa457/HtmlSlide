import { join } from "path";

console.log("\x1b[36m[Bun Build]\x1b[0m Starting compilation & HTML inline bundling...");

// 1. まずは通常のBunビルドを実行してJSとCSSを出力（圧縮モード）
const result = await Bun.build({
  entrypoints: ["./src/scripts/main.js"],
  outdir: "./dist",
  minify: true,
});

if (!result.success) {
  console.error("❌ Build failed:", result.logs);
  process.exit(1);
}

try {
  // 2. 生成されたJS/CSSの成果物と、元のHTML（テンプレート）を高速読み込み
  const jsContent = await Bun.file("./dist/main.js").text();
  const cssContent = await Bun.file("./dist/main.css").text();
  const htmlTemplate = await Bun.file("./index.html").text();

  // 3. HTML内の外部参照タグ（link / script）を、インライン埋め込みタグへ正規表現で置換
  let inlinedHtml = htmlTemplate
    .replace(
      /<link[^>]*href=["']\/dist\/indexMain\.css["'][^>]*>/i,
      `<style>${cssContent}</style>`
    )
    .replace(
      /<script[^>]*src=["']\/dist\/indexMain\.js["'][^>]*><\/script>/i,
      `<script>${jsContent}</script>`
    );

  // 4. 1本化された完成版HTMLを dist/index.html として書き出し！
  await Bun.write("./dist/index.html", inlinedHtml);

  console.log("\x1b[32m[Bun Build] ✨ Success!\x1b[0m Single file bundled into: \x1b[4m./dist/index.html\x1b[0m");

} catch (err) {
  console.error("❌ HTMLのインライン化中にエラーが発生しました:", err);
  process.exit(1);
}