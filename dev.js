import { join } from "path";
import { watch } from "fs";

const PORT = 3000;
const connectedSockets = new Set();

Bun.spawn(
  [
    "bun",
    "build",
    "./src/scripts/main.ts",
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
        ws.send("reload");
      }
    }, 50);
  }
});

watch("./static", (eventType, filename) => {
  if (filename === "slides.md") {
    for (const ws of connectedSockets) {
      ws.send("reload");
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
      if (server.upgrade(req)) return;
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
              const ws = new WebSocket('ws://' + window.location.host + '/_live_reload');
              ws.onmessage = (e) => {
                if (e.data === 'reload') {
                  console.log('[Live Reload] 変更を検知しました。画面を再読み込みします...');
                  window.location.reload();
                }
              };
              ws.onclose = () => console.log('[Live Reload] サーバーとの接続が切断されました。');
            })();
          </script>
        `;
        htmlText = htmlText.replace("</body>", `${clientScript}</body>`);
        // mathxyjax3の読み込みに備え、開発時も type="module" が適用されるようにする
        htmlText = htmlText.replace(
          /<script([^>]*src=["']\/dist\/indexMain\.js["'])/i,
          '<script type="module"$1',
        );
        return new Response(htmlText, {
          headers: { "Content-Type": "text/html" },
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
  `\x1b[36m[Bun Server]\x1b[0m Running at \x1b[4mhttp://localhost:${PORT}\x1b[0m (Live Reload: \x1b[32mActive ✨\x1b[0m)`,
);
