import { join } from "path";
import { watch } from "fs";

const PORT = 3000;
const connectedSockets = new Set();

console.log(
  "\x1b[36m[Bun Server]\x1b[0m Running in professional dev server mode...",
);

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

    // 💡 開発時における分離型デバッグ運用の肝
    // 開発サーバーから配信される main.js のみ、「DEV_HTML:」というマーカーと共に、
    // インライン化を行わない分離参照用のクリーンなHTMLストリームをプレースホルダーへ注入します。
    // 💡 開発時における分離型デバッグ運用の肝
    if (pathname === "/dist/main.js") {
      const file = Bun.file("./dist/main.js");
      if (await file.exists()) {
        let jsText = await file.text();

        const devPresenterHtml = `DEV_HTML:<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>Dynamic Slide System [プレゼンター]</title>
  <link rel="stylesheet" href="/dist/main.css" />
</head>
<body class="present-mode">
  <div id="present-container">
    <iframe id="present-iframe" style="width: 100%; height: 100%; border: none; overflow: hidden" scrolling="no"></iframe>
  </div>
  <div id="fullscreen-hint">全画面表示 (F11)</div>
  <script type="module" src="/dist/presenter.js"></script>
</body>
</html>`;

        const escapedDevPresenterHtml = devPresenterHtml
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\r?\n/g, "\\n");

        jsText = jsText
          .split("__PRESENTER_DATA_PLACEHOLDER__")
          .join(escapedDevPresenterHtml);

        return new Response(jsText, {
          headers: { "Content-Type": "application/javascript" },
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
