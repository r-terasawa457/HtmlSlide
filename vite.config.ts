import { defineConfig, build as viteBuild } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";
import { readFileSync, readdirSync, rmSync } from "fs";

/**
 * src/theme 内のCSSファイルを再帰的・動的に走査してリスト化する関数
 */
function getThemeFiles(dir: string, baseDir = ""): string[] {
  const results: string[] = [];
  try {
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
  } catch (e) {
    // ディレクトリ未存在時はスキップ
  }
  return results;
}

export default defineConfig(async ({ command }) => {
  const themeFiles = getThemeFiles(resolve(__dirname, "static/theme"));
  const embeddedAssets: Record<string, string> = {};

  if (command === "build") {
    // 💡 識別フラグ（isScript）を追加し、TS用のoutPathを直下に修正
    const subApps = [
      {
        key: "/src/entrypoint/stage_view.html",
        input: resolve(__dirname, "src/entrypoint/stage_view.html"),
        outPath: resolve(__dirname, "dist-temp/src/entrypoint/stage_view.html"),
        isScript: false,
        isCompile: true,
      },
      {
        key: "/src/pptx_export.html",
        input: resolve(__dirname, "src/pptx_export.html"),
        outPath: resolve(__dirname, "dist-temp/src/pptx_export.html"),
        isScript: false,
        isCompile: true,
      },
      {
        key: "/src/scripts/pptxExport.ts",
        input: resolve(__dirname, "src/scripts/pptxExport.ts"),
        outPath: resolve(__dirname, "dist-temp/pptxExport.js"), // ライブラリモードで直下に出力されるため
        isScript: true,
        isCompile: true,
      },
      {
        key: "/src/css/slide_root.css",
        input: resolve(__dirname, "src/css/slide_root.css"),
        isCompile: false,
      },
    ];

    const tempDir = resolve(__dirname, "dist-temp");

    for (const app of subApps) {
      try {
        if (app.isCompile === false) {
          embeddedAssets[app.key] = readFileSync(app.input, "utf-8");
          continue;
        }
        // 💡 HTMLとスクリプトでビルドオプションを動的に切り替える
        const buildConfig: any = {
          outDir: tempDir,
          emptyOutDir: false,
          target: "esnext",
        };

        if (app.isScript) {
          buildConfig.lib = {
            entry: app.input,
            formats: ["es"], // 用途に応じて "iife" (即時実行関数) などに変更可能
            fileName: () => "pptxExport.js",
          };
        } else {
          buildConfig.assetsInlineLimit = 100000000;
          buildConfig.rollupOptions = {
            input: app.input,
          };
        }

        await viteBuild({
          configFile: false,
          base: "./",
          publicDir: false,
          plugins: app.isScript
            ? []
            : [tailwindcss(), svelte({ emitCss: false }), viteSingleFile()],
          build: buildConfig,
          logLevel: "warn",
        });

        embeddedAssets[app.key] = readFileSync(app.outPath, "utf-8");
      } catch (e) {
        console.warn(
          `[Vite Pre-build] Warning: Failed to compile ${app.key}`,
          e,
        );
      }
    }

    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {
      // 削除失敗時は無視
    }

    for (const file of themeFiles) {
      try {
        embeddedAssets[`themes/${file}`] = readFileSync(
          resolve(__dirname, `./static/theme/${file}`),
          "utf-8",
        );
      } catch (e) {
        console.warn(`[Vite Build] Warning: Missing theme asset ${file}`);
      }
    }
  }

  return {
    base: "./",
    publicDir: "static",
    plugins: [
      tailwindcss(),
      svelte({
        emitCss: false,
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
