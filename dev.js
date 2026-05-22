import { join } from "path";
import { watch } from "fs";

const PORT = 3000;

// 接続されているブラウザ（クライアント）を管理するセット
const connectedSockets = new Set();

// 1. 裏で自動ウォッチビルドを子プロセスとして起動（JS/CSSの自動更新）
Bun.spawn(["bun", "build", "./src/scripts/main.js", "--outdir", "./dist", "--watch"], {
  stdout: "inherit",
  stderr: "inherit",
});

// 2. 💡 【新機能】成果物（dist）の更新を監視し、ビルド完了後にブラウザへリロード命令を出す
watch("./dist", (eventType, filename) => {
  if (filename && (filename.endsWith(".js") || filename.endsWith(".css"))) {
    // ビルドの書き込み完了をわずかに待ってから全ブラウザにリロードシグナルを送信
    setTimeout(() => {
      for (const ws of connectedSockets) {
        ws.send("reload");
      }
    }, 50);
  }
});

// 3. 💡 【新機能】Markdown（slides.md）自体の変更も直接監視し、保存されたら即リロード
watch("./static", (eventType, filename) => {
  if (filename === "slides.md") {
    for (const ws of connectedSockets) {
      ws.send("reload");
    }
  }
});

// 4. 高性能Web ＋ WebSocket 統合サーバーの起動
Bun.serve({
  port: PORT,
  
  // WebSocketのイベントハンドリング定義
  websocket: {
    open(ws) {
      connectedSockets.add(ws);
    },
    close(ws) {
      connectedSockets.delete(ws);
    },
    message(ws, message) {}
  },

  async fetch(req, server) {
    const url = new URL(req.url);
    let pathname = url.pathname;

    // 💡 【新機能】ブラウザからのライブリロード用接続要求（WebSocket）をアップグレード受付
    if (pathname === "/_live_reload") {
      if (server.upgrade(req)) return;
      return new Response("Upgrade failed", { status: 400 });
    }

    if (pathname === "/") pathname = "/index.html";

    // 💡 【新機能】index.htmlの配信時のみ、開発用リロードスクリプトを「メモリ上で動的注入」
    // これにより、元の index.html を開発専用の汚いコードで汚す必要が一切なくなります！
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
        // HTMLの </body> タグの直前にスクリプトを滑り込ませる
        htmlText = htmlText.replace("</body>", `${clientScript}</body>`);
        return new Response(htmlText, { headers: { "Content-Type": "text/html" } });
      }
    }

    // 通常の静的ファイル配信
    let file = Bun.file(join(".", pathname));
    if (await file.exists()) return new Response(file);

    file = Bun.file(join("./static", pathname));
    if (await file.exists()) return new Response(file);

    return new Response("Not Found", { status: 404 });
  }
});

console.log(`\x1b[36m[Bun Server]\x1b[0m Running at \x1b[4mhttp://localhost:${PORT}\x1b[0m (Live Reload: \x1b[32mActive ✨\x1b[0m)`);