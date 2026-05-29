import { join } from "path";

console.log(
  "\x1b[36m[Bun Build]\x1b[0m Starting compilation & HTML inline bundling...",
);

const result = await Bun.build({
  entrypoints: ["./src/scripts/main.js"],
  outdir: "./dist",
  minify: true,
  target: "browser",
  format: "esm",
});

if (!result.success) {
  console.error("❌ Build failed:", result.logs);
  process.exit(1);
}

try {
  const jsContent = await Bun.file("./dist/main.js").text();
  const cssContent = await Bun.file("./dist/main.css").text();
  const htmlTemplate = await Bun.file("./index.html").text();

  let inlinedHtml = htmlTemplate
    .replace(
      /<link[^>]*href=["']\/dist\/indexMain\.css["'][^>]*>/i,
      `<style>${cssContent}</style>`,
    )
    .replace(
      /<script[^>]*src=["']\/dist\/indexMain\.js["'][^>]*><\/script>/i,
      `<script type="module">${jsContent}</script>`,
    );

  await Bun.write("./dist/index.html", inlinedHtml);

  console.log(
    "\x1b[32m[Bun Build] ✨ Success!\x1b[0m Single file bundled into: \x1b[4m./dist/index.html\x1b[0m",
  );
} catch (err) {
  console.error("❌ HTMLのインライン化中にエラーが発生しました:", err);
  process.exit(1);
}
