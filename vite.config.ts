import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { readFileSync, readdirSync } from "fs";

/**
 * src/theme 内のCSSファイルを再帰的・動的に走査してリスト化する関数
 */
function getThemeFiles(dir: string, baseDir = ""): string[] {
  const results: string[] = [];
  const list = readdirSync(dir, { withFileTypes: true });
  for (const file of list) {
    const res = resolve(dir, file.name);
    const relPath = baseDir ? `${baseDir}/${file.name}` : file.name;
    if (file.isDirectory()) {
      results.push(...getThemeFiles(res, relPath));
    } else if (file.name.endsWith(".css")) {
      results.push(relPath);
    }
  }
  return results;
}

export default defineConfig(({ command }) => {
  const themeFiles = getThemeFiles(resolve(__dirname, "static/theme"));

  // 文字列としてJSに埋め込むアセットの制御
  const embeddedAssets: Record<string, string> = {};
  if (command === "build") {
    const assetMapping: Record<string, string> = {
      // 💡 サーバー上の絶対パス（スラッシュ始まり）をキーにします
      "/src/presenter.html": "./src/presenter.html",
      "/src/pptx_export.html": "./src/pptx_export.html",
      "/src/css/presenter.css": "./src/css/presenter.css",
      "/src/css/slide_root.css": "./src/css/slide_root.css",
    };

    for (const file of themeFiles) {
      // テーマも /themes/filename.css という絶対パス形式のキーで登録
      assetMapping[`/themes/${file}`] = `./src/theme/${file}`;
    }

    for (const [key, path] of Object.entries(assetMapping)) {
      try {
        embeddedAssets[key] = readFileSync(resolve(__dirname, path), "utf-8");
      } catch (e) {
        console.warn(`[Vite Build] Warning: Missing asset ${path}`);
      }
    }
  }

  return {
    publicDir: "static",
    plugins: [
      tailwindcss(),
      svelte({
        compilerOptions: {
          css: "injected",
        },
      }),
      viteSingleFile(),
    ],
    resolve: {
      conditions: ["browser"],
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./vitest.setup.ts"],
      include: ["src/**/*.{test,spec,test.svelte}.ts"],
    },
    define: {
      "globalThis.BuiltinThemesList": JSON.stringify(themeFiles),
      "globalThis.EmbeddedAssets":
        command === "build" ? JSON.stringify(embeddedAssets) : "undefined",
    },
    build: {
      target: "esnext",
      assetsInlineLimit: 100000000,
      chunkSizeWarningLimit: 100000000,
      rollupOptions: {
        input: {
          main: resolve(__dirname, "index.html"),
          presenter: resolve(__dirname, "src/presenter.html"),
          pptxExport: resolve(__dirname, "src/pptx_export.html"),
        },
        output: {
          entryFileNames: "assets/[name].js",
          chunkFileNames: "assets/[name].js",
          assetFileNames: "assets/[name].[ext]",
        },
      },
    },
    server: {
      port: 3000,
      fs: {
        allow: [__dirname],
      },
    },
  };
});
