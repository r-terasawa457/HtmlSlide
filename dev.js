import { join } from "path";
import { watch } from "fs";
import { Glob, plugin } from "bun";
import { SveltePlugin } from "bun-plugin-svelte";

const sveltePluginInstance = SveltePlugin({
  compilerOptions: {
    css: "injected",
  },
});

plugin(sveltePluginInstance);

const PORT = 3000;
const connectedSockets = new Set();

const glob = new Glob("**/*.css");
const themeFiles = Array.from(glob.scanSync({ cwd: "./src/theme" }));
const themeListStr = JSON.stringify(themeFiles);

/**
 * 開発に必要なすべてのスクリプト（メイン、プレゼンター、エクスポート）をコンパイルします。
 */
async function rebuild() {
  console.log("\x1b[36m[Bun Dev]\x1b[0m Compiling scripts...");
  const result = await Bun.build({
    // 💡 プレゼンター、エクスポート用スクリプトもコンパイル対象に含める
    entrypoints: [
      "./src/app.ts",
      "./src/entrypoint/stage_view.ts",
      "./src/scripts/pptxExport.ts",
    ],
    outdir: "./dist",
    target: "browser",
    format: "esm",
    plugins: [sveltePluginInstance],
  });

  if (!result.success) {
    console.error("❌ Programmatic rebuild failed:", result.logs);
  } else {
    console.log("\x1b[32m[Bun Dev]\x1b[0m Compilation success.");
  }
}

await rebuild();

watch("./src", { recursive: true }, async (eventType, filename) => {
  if (
    filename &&
    (filename.endsWith(".ts") ||
      filename.endsWith(".svelte") ||
      filename.endsWith(".css"))
  ) {
    await rebuild();
    for (const ws of connectedSockets) {
      ws.send(JSON.stringify({ type: "reload" }));
    }
  }
});

watch("./static", (eventType, filename) => {
  if (filename === "slides.md") {
    for (const ws of connectedSockets) {
      ws.send(JSON.stringify({ type: "reload" }));
    }
  }
});

Bun.serve({
  port: PORT,

  websocket: {
    open(ws) {
      connectedSockets.add(ws);
    },
    close(ws) {
      connectedSockets.delete(ws);
    },
    message(ws, message) {},
  },

  async fetch(req, server) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    if (pathname === "/_live_reload") {
      if (server.upgrade(req, { data: {} })) return;
      return new Response("Upgrade failed", { status: 400 });
    }

    if (pathname === "/") pathname = "/index.html";

    if (pathname === "/index.html") {
      const file = Bun.file("./index.html");
      if (await file.exists()) {
        let htmlText = await file.text();

        const clientScript = `
          <script>
            (function() {
              globalThis.BuiltinThemesList = ${themeListStr};
              const ws = new WebSocket('ws://' + window.location.host + '/_live_reload');
              ws.onmessage = (e) => {
                try {
                  const payload = JSON.parse(e.data);
                  if (payload.type === 'reload') window.location.reload();
                } catch(err) {}
              };
            })();
          </script>
        `;
        htmlText = htmlText.replace("</body>", `${clientScript}</body>`);
        htmlText = htmlText.replace(
          /<script([^>]*src=["']\/dist\/main\.js["'])/i,
          '<script type="module"$1',
        );
        return new Response(htmlText, {
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    if (pathname.startsWith("/themes/")) {
      const themePath = pathname.slice(8);
      const themeFile = Bun.file(join("./src/theme", themePath));

      if (await themeFile.exists()) {
        return new Response(themeFile, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    let file = Bun.file(join(".", pathname));
    if (await file.exists()) return new Response(file);

    // 💡 AssetProvider が要求する src フォルダ直下（presenter.html 等）へのルーティングを通す
    file = Bun.file(join("./src", pathname.replace(/^\/src\//, "/")));
    if (await file.exists()) return new Response(file);

    file = Bun.file(join("./static", pathname));
    if (await file.exists()) return new Response(file);

    return new Response("Not Found", { status: 404 });
  },
});

console.log(
  `\x1b[36m[Bun Server]\x1b[0m Running at \x1b[4mhttp://localhost:${PORT}\x1b[0m`,
);
