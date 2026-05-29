import { join } from "path";
import { watch } from "fs";

const PORT = 3000;
const connectedSockets = new Set();
const LOG_FILE_PATH = "./dist/browser-errors.log";
const CODE_FILE_PATH = "./dist/main.js";

// 開発サーバー起動時にログファイルを空のJSON配列にリセット
await Bun.write(LOG_FILE_PATH, "[]");

Bun.spawn(
  ["bun", "build", "./src/scripts/main.ts", "--outdir", "./dist", "--watch"],
  {
    stdout: "inherit",
    stderr: "inherit",
  },
);

watch("./dist", (eventType, filename) => {
  if (filename && (filename.endsWith(".ts") || filename.endsWith(".css"))) {
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

/**
 * ブラウザから受信したエラーデータを構造化JSONとしてdist内に保存する。
 * ソースコードビルドのタイムスタンプ（世代）が最新の5件（5種類）分を残し、
 * ログの追加順（記述順）が変わらないようにフィルター処理を行う。
 * @param {Object} errorData - ブラウザから転送されたエラーコンテキスト
 * @returns {Promise<void>}
 */
async function writeBrowserLog(errorData) {
  const file = Bun.file(LOG_FILE_PATH);
  let logs = [];

  if (await file.exists()) {
    try {
      logs = JSON.parse(await file.text());
    } catch (e) {
      logs = [];
    }
  }

  const codeFile = Bun.file(CODE_FILE_PATH);
  const codeTimestamp = (await codeFile.exists())
    ? new Date(codeFile.lastModified).toISOString()
    : new Date().toISOString();

  logs.push({
    timestamp: codeTimestamp,
    ...errorData,
  });

  // 💡 タイムスタンプのユニーク値（ビルド世代）を抽出し、新しい順から5件分を特定
  const uniqueTimestamps = [...new Set(logs.map((l) => l.timestamp))]
    .sort()
    .slice(-5);

  // 💡 元の記述順（時系列）を維持したまま、最新5世代に該当するログのみを抽出
  logs = logs.filter((l) => uniqueTimestamps.includes(l.timestamp));

  await Bun.write(LOG_FILE_PATH, JSON.stringify(logs, null, 2));
}

Bun.serve({
  port: PORT,

  websocket: {
    open(ws) {
      connectedSockets.add(ws);
    },
    close(ws) {
      connectedSockets.delete(ws);
    },
    async message(ws, message) {
      try {
        const payload = JSON.parse(message);
        if (payload.type === "error_log") {
          await writeBrowserLog(payload.data);
        }
      } catch (e) {}
    },
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
                  if (payload.type === 'reload') {
                    console.log('[Live Reload] 変更を検知しました。画面を再読み込みします...');
                    window.location.reload();
                  }
                } catch(err) {}
              };

              function sendErrorToServer(message, source, lineno, colno, error) {
                if (ws.readyState === WebSocket.OPEN) {
                  const logPayload = {
                    message: message || '',
                    source: source || '',
                    lineno: lineno || 0,
                    colno: colno || 0,
                    stack: error ? error.stack : ''
                  };
                  ws.send(JSON.stringify({ type: 'error_log', data: logPayload }));
                }
              }

              window.onerror = function(message, source, lineno, colno, error) {
                sendErrorToServer(message, source, lineno, colno, error);
                return false;
              };

              window.addEventListener('error', function(event) {
                if (event.target && event.target !== window) {
                  const source = event.target.src || event.target.href || event.target.tagName;
                  sendErrorToServer('Resource Load Failed (404 or Network Error)', source, 0, 0, null);
                }
              }, true);

              const originalConsoleError = console.error;
              console.error = function(...args) {
                originalConsoleError.apply(console, args);
                if (ws.readyState === WebSocket.OPEN) {
                  sendErrorToServer(args.join(' '), 'console.error', 0, 0, null);
                }
              };

              ws.onclose = () => console.log('[Live Reload] サーバーとの接続が切断されました。');
            })();
          </script>
        `;
        htmlText = htmlText.replace("</body>", `${clientScript}</body>`);
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
  `\x1b[36m[Bun Server]\x1b[0m Running at \x1b[4mhttp://localhost:${PORT}\x1b[0m (Live Reload & AI-Optimized Log: \x1b[32mActive ✨\x1b[0m)`,
);
