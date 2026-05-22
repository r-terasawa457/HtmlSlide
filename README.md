# htmlslide

Markdown原稿から16:9のHTMLスライドを生成する個人用ツール。
BunおよびTypeScriptで開発。

## 主な機能

- **アセットのインライン化**: ビルド時にすべてのJS、CSS、外部ライブラリを1枚のHTML（`dist/index.html`）内に埋め込みます。
- **原稿の外部化**: スライド原稿（`slides.md`）は実行時に動的フェッチされるため、原稿更新時の再ビルドは不要です。
- **画面モードの切り替え**: URLパラメータ（`?mode=present`）に応じて、ツールバー付きの「ビューアー」と、全画面用の「プレゼンター」を同一ドキュメント内で切り替えます。
- **自動リロード**: 開発サーバー（`dev.js`）の起動中、ソースコードやMarkdownの変更を検知してブラウザを自動リロードします。
- **印刷最適化**: 16:9の論理サイズ（960pt × 540pt）に対応。印刷時はツールバーやスライドの影を自動で非表示にします。

## ディレクトリ構成

```text
my-slide-project/
├── .vscode/          # ワークスペース設定
├── dist/             # ビルド成果物（インライン化された index.html）
├── src/
│   ├── css/          # スタイルシート（slides.css, viewer.css, present.css）
│   └── scripts/      # main.ts, SlidesEngine.ts, 各種Marked拡張プラグイン
├── static/           # 画像アセット、スライド原稿（slides.md）
├── index.html        # テンプレート用HTML
├── dev.js            # 自動ビルド・リロード機能付き開発サーバー
└── build.js          # インライン化ビルドスクリプト

```

## 使い方

### 依存関係のインストール

```bash
bun install

```

### 1. 開発サーバーの起動

```bash
bun run dev

```

- `http://localhost:3000` でビューアーが起動します。
- ファイル変更時にブラウザが自動で再読み込みされます。

### 2. 配布用HTMLのビルド

```bash
bun run build

```

- `dist/index.html` にJS/CSSが埋め込まれた完成版HTMLが生成されます。

## バージョン履歴

- v0.1.0

```

```
