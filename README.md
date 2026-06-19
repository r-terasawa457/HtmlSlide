# htmlslide (Dynamic Slide System)

Markdown原稿とアセット群をブラウザにドラッグ＆ドロップするだけで、即座に高機能な16:9のHTMLスライドを動的に生成・閲覧・プレゼン・出力できる、完全ローカル完結型のWebスライド生成システムです。

**ブラウザ上（クライアントサイド）での動的コンパイル、双方向マルチウィンドウ同期、および高度な前処理を伴うPPTXエクスポート**をサポートしています。

---

## 🚀 主な機能

### 1. ゼロ構成のドラッグ＆ドロップ・インポート

- Markdownファイル（`.md`）や画像アセット（`png`, `jpeg`, `gif`, `svg`, `webp`）、独自の `css` ファイルをまとめてブラウザにドロップするだけで、インメモリに展開されて即座にスライド化されます。
- **ローカル環境（`file://`）対応**: ブラウザのセキュリティ制限によるフォルダ解析エラーを検知すると、自動的にファイルをフラットに吸い上げるフォールバックモードへ切り替わります。

### 2. 高度な拡張Markdownエンジン (`SlideEngine2`)

- **メタデータ・変数置換**: 原稿先頭のメタデータからタイトルや変数を抽出し、スライド内の `{% page-number %}` や `{% page-total %}` などのシステム変数やカスタム変数を動的に再帰置換します。置換後にインラインパースを行うため、変数内のMarkdown構文も正しくレンダリングされます。
- **スコープ付きスタイル**: 各スライド固有、または共通のスタイルは、CSSの汚染を防ぐため自動的に `@scope` でカプセル化されて注入されます。
- **数式・構文ハイライト**: `markdown-it-mathjax3` による高精度な数式表示（MathJax）と、`highlight.js` によるコードブロックのシンタックスハイライトに標準対応。
- **コロンブロック拡張 (`ColonBlockPlugin`)**: `:: [tag] [attrs] :: content`（単一形式）および `::: [tag] [attrs] \n inner \n :::`（複数行形式）に対応し、クラス名やスタイル属性を柔軟に付与したHTML構造をMarkdownから直接生成できます。

### 3. スマートなマルチウィンドウ連携（ステージビュー）

- メインビューアーから「プレゼン」や「ステージビュー」を立ち上げると、Blob URLや安全なメッセージパッシングを用いて、発表者・複製用の別ウィンドウ（ステージビュー）が立ち上がります。
- メインビューアーのスクロール位置、ページインデックス、ズーム倍率が双方向にリアルタイム同期します。

### 4. 職人技的な前処理を伴う高精度PPTXエクスポート

- `dom-to-pptx` をベースに、PowerPoint書き出し時の表示崩れを防ぐための強力な自動前処理（DOMの最適化）を行います。
- **コードブロックの画像化**: ハイライトやインデント、フォント、高さを完全に再現するため、`html2canvas` を用いて高解像度（`scale: 2`）のPNG画像へ自動置換します。
- **MathJax (SVG) の px置換・クレンジング**: アクセシビリティ用の非表示MathML（`math` タグなど）を完全に除去してゴミテキストの混入を防ぐとともに、SVGのサイズ単位（`ex`など）をバウンディングボックスから計算した絶対 `px` 単位に書き換えることで、正確なベクター（SVG as Vector）としてPPTXへ書き出します。

### 5. 閲覧ビューアー・印刷（PDF）最適化

- **レスポンシブ・ズーム / 自動フィット**: 基準サイズ（1280 × 720）に対して、ブラウザサイズに合わせた自動フィット（`Fit Height` / `Fit Width`）、等倍表示（`Original`）、カスタムズームに対応。
- **環境適応型アセットプロバイダー**: 実行環境を自動識別し、開発時は `httpProvider`（Fetch API経由）、ビルド後は `portableProvider`（単一HTML内に文字列として内包された `EmbeddedAssets` 経由）に透過的に切り替わります。

---

## 🔌 エントリーポイント

本プロジェクトは **Vite** を用いたマルチページ・ビルド構成を採用しており、以下の3つのエントリーポイントから構築されています。

1. **メインビューアー (`index.html`)**
   - **パス**: `/index.html` (ルート)
   - **役割**: システムのメインユーザーインターフェース。ファイルのドロップ受付、ビューアーの描画、各種コントロール操作を行います。
   - **スクリプト**: `/src/app.ts` を起点とし、Svelte 5コンポーネントである `App.svelte` をマウントします。

2. **ステージビュー (`src/entrypoint/stage_view.html`)**
   - **パス**: `/src/entrypoint/stage_view.html`
   - **役割**: プレゼンテーション進行やプロジェクター等への外部出力用の複製画面。親ウィンドウからの操作・スクロールイベント、パース済みスライドデータをリアルタイムに同期して描画します。
   - **スクリプト**: `/src/entrypoint/stage_view.ts` を起点とし、`StageViewMain.svelte` をマウントします。

3. **PPTXエクスポート用ウィンドウ (`src/pptx_export.html`)**
   - **パス**: `/src/pptx_export.html`
   - **役割**: PPTXエクスポート時にバックグラウンドで一時的に生成される非表示の `iframe` のテンプレート。親のビューアーから渡されたスライドHTMLとCSSを読み込み、MathJaxのSVGサイズ置換やコードブロックの画像化といった重い前処理を実行した上で、`dom-to-pptx` を用いてエクスポート処理を安全に実行・管理します。

---

## 📂 ディレクトリ構成

> ⚠️ **【重要】移行に伴う構造上の注意**
>
> 現在、本プロジェクトは **`Common/SlideIframe` + `ViewCore` から Svelte 5 ベースの最新コンポーネント `SlideCanvas` への移行途中**、および **`Core` 以下への移行準備中**です。
> そのため、新旧の設計・コンポーネントが一部混在しており、ディレクトリ構造が過渡期特有の状態になっています。
> 実装を追う際は、上記3つのエントリーポイントからインポートされている最新のパスをご確認ください。

主要なソースコード構造は以下の通りです。

```text
htmlslide/
├── index.html                   # メインビューアーのベースHTML (エントリーポイント1)
├── vite.config.ts               # Viteの統合ビルド・環境定義設定
├── tsconfig.json                # TypeScriptの型安全およびパスエイリアス設定
├── package.json                 # プロジェクト依存・スクリプト管理
├── docs/                        # 仕様設計・移行計画などのドキュメント
│   └── Slide移行仕様.md          # SlideCanvas等への移行に関する詳細なロードマップ
├── src/
│   ├── app.ts                   # メインアプリのブートストラップスクリプト
│   ├── app.css                  # Tailwind v4 のグローバルエントリー
│   ├── pptx_export.html         # PPTXエクスポート用HTML (エントリーポイント3)
│   ├── svelte-env.d.ts          # Svelte用環境型定義
│   │
│   ├── entrypoint/
│   │   ├── stage_view.html      # ステージビュー用HTML (エントリーポイント2)
│   │   └── stage_view.ts        # ステージビューのブートストラップスクリプト
│   │
│   ├── components/              # Svelte 5UIコンポーネント群
│   │   ├── App.svelte           # ルートアプリケーション
│   │   ├── DropZone.svelte      # ファイルドロップUI
│   │   ├── ViewerMain.svelte    # メインビューアー
│   │   ├── StageViewMain.svelte # ステージビュー(複製画面)
│   │   ├── Slide/               # スライド描画コア
│   │   │   ├── SlideCanvas.svelte  # 現在のコアスライド描画コンポーネント
│   │   │   └── types.ts         # スライドパースデータ等の型定義
│   │   ├── Common/              # 旧Common系コンポーネント（順次移行中・廃止予定）
│   │   ├── Core/                # 新Core系コンポーネント（移行準備中）
│   │   ├── Viewer/              # ビューアーUI（ツールバー、コントロールなど）
│   │   └── Print/               # 印刷(PDF出力)マネージャー
│   │
│   ├── scripts/                 # ロジック・ヘルパースクリプト群
│   │   ├── FileDropScanner.ts   # D&Dおよびファイル走査制御
│   │   ├── SlideEngine2.ts      # markdown-itの初期化・ルール定義・パース
│   │   ├── pptxExport.ts        # PPTX前処理・エクスポート実行スクリプト
│   │   ├── pptxExportController.ts # 非表示iframeによるPPTX書き出し統括
│   │   └── AssetProvider/       # 環境適応型アセットプロバイダー
│   │       ├── index.ts         # プロバイダーエントリー
│   │       ├── types.ts         # プロバイダーインターフェース定義
│   │       ├── httpProvider.ts  # 開発環境用 (HTTP/Fetch)
│   │       └── portableProvider.ts # 製品環境用 (埋め込みシリアライズ文字列)
│   │
│   ├── states/                  # Svelte 5 の `$state` を用いた状態層
│   │   ├── AppState.svelte.ts   # アプリケーション全体状態
│   │   └── ViewerState.svelte.ts # ビューアー詳細表示・同期状態
│   │
│   └── theme/                   # スライド・エディタ用のスタイルアセット
│       ├── slide-thema-default.css # 標準テーマ
│       └── vs.css               # コードシンタックスハイライトテーマ
```

---

## 🛠️ 開発とビルド

ビルドおよび開発には **Vite** を使用しています。

### 依存関係のインストール

```bash
bun install
# または
npm install
```

### 開発サーバーの起動

```bash
bun run dev
# または
npm run dev
```

- `http://localhost:3000` で開発用サーバーが立ち上がります。
- メインビューアーのほか、`src/entrypoint/stage_view.html`、`src/pptx_export.html` もルーティング経由でホットリロード（HMR）動作します。

### 単一HTML（スタンドアロン成果物）のビルド

```bash
bun run build
# または
npm run build
```

- 各種コンパイルが実行され、すべてのTypeScript、CSS、アセットテンプレートが `globalThis.EmbeddedAssets` に一括インラインシリアライズされます。
- `vite-plugin-singlefile` により、**完全自己完結型（ポータブル）の単一HTMLファイル**にビルドされます。
- 出力先: `./dist/index.html`
- 生成された1枚のHTMLファイルは、完全オフラインやネットワーク制限のある環境でも全機能が完全に動作します。

### テストの実行

本プロジェクトは **Vitest** によるテストをサポートしています。

```bash
bun run test
# または
npm run test
```

---

## 🛠️ ユーザー操作・システム仕様

### 1. スライドの生成方法

1. ブラウザに表示されるドロップゾーン（`DropZone`）に、作成したMarkdownファイル（`.md`）をドラッグ＆ドロップします。
2. 相対パスで読み込んでいる画像やカスタムCSSがある場合、**Markdownファイルと一緒にまとめて複数選択してドロップ**するか、**フォルダごとドロップ**してください。

### 2. ビューアーの操作

- **表示モード**: `Fit Height`（デフォルト、縦幅に収める）, `Fit Width`（横幅に合わせる）, `Original`（1280x720の等倍表示）, カスタムズームに対応。
- **ナビゲーション**: 縦スクロールとページインデックスがリアルタイムに双方向バインドされます。コントロールバーのページ欄に直接数値を入力することでも移動できます。

### 3. プレゼンテーション・ステージビュー

- 「ステージビュー」ボタンにより、複製・発表者用のウィンドウを別画面で立ち上げ、スクロールやズーム、ページめくりをスムーズに双方向リアルタイム同期させることが可能です。

### 4. PPTX / PDF エクスポート

- **PPTX**: 「pptxに出力」により、一時的な画面外iframe (`src/pptx_export.html`) 内で高解像度レンダリング等の前処理を行ったうえで、PowerPointスライドとして書き出しを行います。
- **PDF**: 印刷モードに移行し、ブラウザの印刷設定 (`Ctrl + P`) から「PDFに保存」を選択することで綺麗な16:9比率のPDFを生成できます。

---

## 📝 Markdown 記述の仕様

### ページの区切り

独立した行の `---`（水平線）で記述します。

```markdown
# 1ページ目のタイトル

ここに内容が入ります。

---

# 2ページ目のタイトル

ページが切り替わりました。
```

### コロンブロックによるHTML拡張 (`ColonBlockPlugin`)

特定のタグで要素を囲い、クラスやスタイルを柔軟に付与できます。

#### ① 単一ライン形式 (`::`)

`::[タグ名] [属性] :: [コンテンツ]`

```markdown
これは :: span class="highlight" style="color: red;" :: 強調したいテキスト :: です。
```

#### ② 複数行コンテナ形式 (`:::`)

`::: [タグ名] [属性] \n 内部コンテンツ \n :::`

```markdown
:::section id="features" class="grid-layout"

### 特徴セクション

- 項目1
- 項目2

:::
```

### システム変数

パース時に以下の変数が自動で動的置換されます。

- `{% page-number %}` : 現在のページ番号 (1始まり)
- `{% page-total %}` : スライドの総ページ数
- フロントマター(メタデータ)等で定義したカスタム変数

---

## 🛠️ 主要な技術スタック・依存関係

- **フロントエンドフレームワーク**: [Svelte v5](https://svelte.dev/)
- **ビルドツール**: [Vite](https://vite.dev/) & [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile)
- **スタイルシステム**: [Tailwind CSS v4](https://tailwindcss.com/)
- **テストランナー**: [Vitest](https://vitest.dev/)
- **Markdownパーサー**: [markdown-it](https://github.com/markdown-it/markdown-it)
- **数式・ハイライト**: `markdown-it-mathjax3`, `highlight.js`
- **PPTX生成 / DOMキャプチャ**: `dom-to-pptx`, `html2canvas`
