import { join } from "path";
import { watch } from "fs";

const PORT = 3000;
const connectedSockets = new Set();

console.log(
  "\x1b[36m[Bun Server]\x1b[0m Starting development server & file watchers...",
);

// 1. main.ts と presenter.ts の双方を並行してコンパイル・自動監視(watch)モードで起動
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

// アセット変更検知時のブラウザ自動リロード通知
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

    // 2. ビューアー主画面の配信（ライブリロード用スクリプトの注入）
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
                  if (payload.type === 'reload') {
                    console.log('[Live Reload] 変更を検知しました。画面を再読み込みします...');
                    window.location.reload();
                  }
                } catch(err) {}
              };
              ws.onclose = () => console.log('[Live Reload] サーバーとの接続が切断されました。');
            })();
          </script>
        `;
        htmlText = htmlText.replace("</body>", `${clientScript}</body>`);

        // 以前の古いファイル名表記(indexMain.js)の置換痕跡を、実際の main.js に合わせてクレンジング修正
        htmlText = htmlText.replace(
          /<script([^>]*src=["']\/dist\/main\.js["'])/i,
          '<script type="module"$1',
        );

        return new Response(htmlText, {
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    // 💡 複雑な箇所への補足（デバッグ運用の核心部）:
    // main.jsへのリクエストが発生した際、内部のプレースホルダー「__PRESENTER_HTML_STRING__」に対して
    // あえてCSSやJSをインライン化せず、個別の外部ファイルとして読み込ませる「開発専用の分離型HTML」を動的注入します。
    // これにより、ブラウザはポップアップ展開後に独立したリソースとしてCSS/JSをサーバーに要求するため、
    // F12デベロッパーツールの Source タブでファイルを完全に分離させた状態でのデバッグ運用が可能になります。
    if (pathname === "/dist/main.js") {
      const file = Bun.file("./dist/main.js");
      if (await file.exists()) {
        let jsText = await file.text();

        const devPresenterHtml = `<!DOCTYPE html>
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

        // 置換文字列内（ミニファイコード）に含まれる特殊記号によるエスケープ破壊を防ぐ安全設計
        jsText = jsText.replace("__PRESENTER_HTML_STRING__", () => {
          return devPresenterHtml
            .replace(/\\/g, "\\\\")
            .replace(/`/g, "\\`")
            .replace(/\$/g, "\\$");
        });

        return new Response(jsText, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }

    // 3. 分離された静的ファイルの標準配信（/dist/main.css, /dist/presenter.js 等はここを通過）
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
