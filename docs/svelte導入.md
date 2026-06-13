"# Svelte 5移行に伴うフロントエンド仕様概要および移行計画書

本ドキュメントは、既存のTypeScriptおよび命令的DOM操作で構築されたスライド生成アプリケーション（htmlslide）に対し、Bunをベースとしたビルド環境の刷新、およびSvelte 5（Runesアーキテクチャ）を導入するための仕様概要と段階的な移行計画をまとめたものです。

---

## 1. 導入の目的と基本方針

- **宣言的UIへの移行による保守性向上:** `document.getElementById` や `insertAdjacentHTML` による命令的なDOM生成・操作を、Svelteの宣言的データバインディングに置き換え、コードの見通しを大幅に向上させます。
- **Svelte 5 Runesによる状態管理の一元化:** 「現在のページ番号」「総ページ数」「ズーム倍率」「表示モード」といった、コンポーネント間やウィンドウ間で同期が必要な状態を、Svelte 5の最新機能であるRunes（`$state`, `$derived`, `$effect`）を用いて安全かつ簡潔に管理します。
- **ポータビリティの維持:** 本プロジェクトの強みである「単一HTMLでの成果物出力（製品環境仕様）」を損なわないよう、コンパイルされたコンポーネントスタイルをJavaScriptへインジェクトする構成をとります。

---

## 2. 仕様概要

### 2.1. 技術スタックおよび環境

| レイヤー            | 採用技術          | 備考 / 変更点                                                     |
| :------------------ | :---------------- | :---------------------------------------------------------------- |
| ランタイム / ビルド | Bun               | 既存の高速なビルドパイプラインをそのまま継承。                    |
| UIフレームワーク    | Svelte 5          | Runesアーキテクチャに基づき、シームレスなリアクティビティを実現。 |
| バンドルプラグイン  | bun-plugin-svelte | BunのネイティブBundlerにSvelteコンパイラを統合。                  |

### 2.2. Svelte 5 Runesを用いた状態管理設計

ビューアー内の主要な状態は、シリアライズやリアクティブな監視が容易なクラスベース、またはステートオブジェクトとして定義します。不要なコメントを排し、実装に直結するドキュメンテーション（docstring）を記述します。

```typescript
/**
 * ビューアー内の表示状態およびナビゲーションを統括するステート管理クラス
 */
export class ViewerState {
  currentPage = $state(1);
  totalPages = $state(0);
  currentZoom = $state(1.0);
  currentMode = $state("FIT_HEIGHT");

  zoomPercentage = $derived(`${Math.round(this.currentZoom * 100)}%`);

  /**
   * コンテナサイズを基に適切なズーム倍率を自動再計算する
   */
  updateLayout(vW: number, vH: number, baseW: number, baseH: number): void {
    if (this.currentMode === "ORIGINAL") {
      this.currentZoom = 1.0;
    } else if (this.currentMode === "FIT_WIDTH") {
      this.currentZoom = vW / baseW;
    } else if (this.currentMode === "FIT_HEIGHT") {
      let scale = vH / baseH;
      if (baseW * scale > vW) {
        scale = vW / baseW;
      }
      this.currentZoom = scale;
    }
  }
}
```

### 2.3. コンポーネント分割構成案

- **App.svelte:** アプリケーションのエントリー。ファイルドロップ前（`DropZone`）とドロップ後（`ViewerCore` / `ControlBar`）のビュー切り替えを統括。
- **DropZone.svelte:** 既存の `FileDropScanner.ts` を内包し、ドラッグ＆ドロップイベントの制御とパース完了後のデータ受け渡しを担うレイヤー。
- **Viewer/ViewerCore.svelte:** スライドプレビュー用iframeの描画、およびスクロール位置に応じた `currentPage` の更新監視（`$effect` の活用）。
- **Viewer/ControlBar.svelte:** ページ移動、ズーム制御（Original, FitHeight, FitWidth）、印刷、および `PptxExportController` を叩くエクスポートボタンを配置するツールバー。
- **Presenter/PresenterCore.svelte:** 別ウィンドウで起動するプレゼンターモード専用のコンポーネント。キーボードイベント（矢印キー、Space等）によるページ送り、および親ウィンドウ（Viewer）との `postMessage` による双方向同期を制御。

---

## 3. ビルド環境の刷新仕様（Bunベース）

既存の `build.js` および `dev.js` へ `bun-plugin-svelte` を組み込みします。成果物を単一HTMLに埋め込むポータブルな構成を実現するため、コンパイラオプションでCSSのJSインジェクトを強制します。

```javascript
import { plugin } from "bun";
import { bunPluginSvelte } from "bun-plugin-svelte";

plugin(
  bunPluginSvelte({
    compilerOptions: {
      css: "injected",
    },
  }),
);

await Bun.build({
  entrypoints: ["./src/scripts/main.ts"],
  outdir: "./dist",
  minify: true,
});
```

---

## 4. 移行計画（4フェーズロードマップ）

1. **Phase 1: ビルド環境構築とエントリーマウントの変更**

- `svelte` および `bun-plugin-svelte` のインストール。
- `build.js` / `dev.js` を上記刷新仕様に書き換え、ビルドパイプラインを通す。
- `index.html` を簡素化し、`main.ts` から `App.svelte` をマウントする最小構成へ移行。

2. **Phase 2: ファイルドロップレイヤーのコンポーネント化（DropZone.svelte）**

- `main.ts` 内の `init()` ロジック、および `processDroppedFiles` を `DropZone.svelte` 内にカプセル化。
- アセットマップの作成や `FileReader` によるMarkdown・CSSの非同期読み込みロジックは既存のものをそのまま流用し、パース完了後に親（App）へ状態を受け渡すカスタムイベント（またはコールバック）を実装。

3. **Phase 3: ビューアーUIへのSvelte 5の全面適用**

- `viewer.ts` の巨大なDOM操作、スタイル書き換えロジックを `ViewerCore.svelte` と `ControlBar.svelte` に分配。
- ズームやページ番号入力を `bind:value` による双方向バインディングへ置換。
- `PptxExportController.export` への接続、および印刷イベントハンドラ（Ctrl+P）のバインディング。

4. **Phase 4: プレゼンターウィンドウの移行とクリーンアップ**

- `presenter.ts` / `presenter.html` のロジックを `PresenterCore.svelte` へリプレイス。
- `window.addEventListener("message", ...)` のイベントリスナーを `$effect` 内で安全に登録・解除するよう最適化。
- 役割を終えた `viewer.html` や `presenter.html` などの古い静的テンプレートファイルを削除。
