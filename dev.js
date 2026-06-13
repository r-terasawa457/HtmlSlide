import { join } from "path";
import { watch } from "fs";
import { Glob } from "bun";
import { bunPluginSvelte } from "bun-plugin-svelte";

plugin(
  bunPluginSvelte({
    compilerOptions: {
      css: "injected", // 単一HTML出力を容易にするため、CSSはJSにインジェクト
    },
  }),
);

const PORT = 3000;
const connectedSockets = new Set();

const glob = new Glob("**/*.css");
const themeFiles = Array.from(glob.scanSync({ cwd: "./src/theme" }));
const themeListStr = JSON.stringify(themeFiles);

// 1. main.ts と presenter.ts の双方を並行してwatch監視コンパイル起動
Bun.spawn(
  [
    "bun",
    "build",
    "./src/scripts/main.ts",
    "./src/scripts/presenter.ts",
    "--outdir",
    "./dist",
    "--watch",
    "--target=browser",
    "--format=esm",
  ],
  {
    stdout: "inherit",
    stderr: "inherit",
  },
);

watch("./dist", (eventType, filename) => {
  if (filename && (filename.endsWith(".js") || filename.endsWith(".css"))) {
    setTimeout(() => {
      for (const ws of connectedSockets) {
        ws.send(JSON.stringify({ type: "reload" }));
      }
    }, 50);
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

        // 💡 開発環境用ブラウザにも BuiltinThemesList を注入
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

    // 💡 開発環境用アセットのルーティングを完全に自動化 (ハードコードの削除)
    if (pathname.startsWith("/themes/")) {
      const themePath = pathname.slice(8); // "/themes/" を除去
      const themeFile = Bun.file(join("./src/theme", themePath));

      if (await themeFile.exists()) {
        return new Response(themeFile, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    let file = Bun.file(join(".", pathname));
    if (await file.exists()) return new Response(file);

    file = Bun.file(join("./static", pathname));
    if (await file.exists()) return new Response(file);

    return new Response("Not Found", { status: 404 });
  },
});

console.log(
  `\x1b[36m[Bun Server]\x1b[0m Running at \x1b[4mhttp://localhost:${PORT}\x1b[0m (Live Reload: Active)`,
);
