Bun + Vite + Svelte 5 (Runes) 環境に最適化された、スタイル隔離型スライドレンダリングコンポーネント `SlideCanvas` の `README.md` です。

プロジェクトのコンポーネントディレクトリにそのまま配置してご活用ください。

---

# SlideCanvas

`SlideCanvas` は、Markdown-it などのパーサーによって生成されたスライドの HTML テキストを、アプリケーション側のスタイル（Tailwind CSS 等）から完全に隔離してレンダリングするための Svelte 5 専用コンポーネントです。

内部で `<iframe>` (`srcdoc`) を利用した独立空間を生成し、かつ `$effect` とネイティブの `innerHTML` を組み合わせることで、Svelte の差分検知オーバーヘッドを排除した最高速の描画パフォーマンスを実現しています。

## 特徴

- 🛡️ **完全なスタイル隔離:** `iframe` による独立文書空間により、メインアプリの Tailwind CSS（Preflight 等）によるデザイン破壊を 100% 防ぎます。
- 📐 **アスペクト比を維持した自動スケーリング:** スライド本来のレンダリング解像度を自動計測し、親コンテナのサイズに合わせて `transform: scale()` を用いた歪みのないフィッティングを行います。
- ⚡ **高速なレンダリングベース:** 文字列ベースの構造化データを `$effect` 内で一括注入するため、大量のスライドでもメモリ消費と描画負荷を最小限に抑えます。
- 縦スクロール表示（全ページ表示）とフィット表示（特定1ページ表示）の双方を同一コンポーネントでサポート。
- `height="fit-content"` 指定時には、縮小後の実際の表示高さを計算してラッパーにフィードバックするため、CSS スケール特有の「不自然な余白」が発生しません。

---

## データ構造 (`ParsedSlideData`)

スライドデータは、コンポーネントに渡す前に以下のような構造化文字列データにパースして保持してください。

```typescript
export interface ParsedSlideData {
  // <div class="slides"> 自体に付与するクラスやデータ属性のマップ
  containerAttrs: Record<string, string>;

  // スライド直下に配置される、全ページ共通のスタイルタグ等（data-original-index付与推奨）
  commons: string[];

  // 各 <section class="page">...</section> の outerHTML 文字列の配列
  // 各ページ固有の @scope スタイルタグなどは、この page 文字列の内部に内包させてください
  pages: string[];
}
```

---

## 使い方

### 1. 基本的な実装例（1ページフィット表示）

```svelte
<script lang="ts">
  import SlideCanvas from './components/Slide/SlideCanvas.svelte';
  import type { ParsedSlideData } from './types/slide';

  // サンプルデータ
  const slideData: ParsedSlideData = {
    containerAttrs: { class: 'slides-container' },
    commons: ['<style>@scope { section.page { width: 1920px; height: 1080px; background: #fff; } }</style>'],
    pages: [
      '<section class="page" id="slide-1"><h1>表紙</h1><style>@scope { h1 { color: tomato; } }</style></section>',
      '<section class="page" id="slide-2"><h1>2ページ目</h1></section>'
    ]
  };

  let currentPage = $state(0);
</script>

<div class="editor-preview-area">
  <SlideCanvas
    data={slideData}
    mode="fit"
    currentPageIndex={currentPage}
    width="100%"
    height="100%"
  />
</div>

<button onclick={() => currentPage++}>次へ</button>

<style>
  .editor-preview-area {
    width: 800px;
    height: 450px;
    border: 1px solid #ccc;
  }
</style>

```

### 2. 縦並びスクロール表示 & fit-content の利用

ダッシュボードや一覧画面などで、スライドを横幅いっぱいに広げつつ、高さはコンテンツの縮小サイズにぴったり合わせたい場合の指定方法です。

```svelte
<SlideCanvas
  data={slideData}
  mode="scroll"
  width="100%"
  height="fit-content"
/>

```

---

## API リファレンス

### Props

| プロパティ名 | 型                | デフォルト値 | 説明                                           |
| ------------ | ----------------- | ------------ | ---------------------------------------------- | ------------------------------------------------------- |
| `data`       | `ParsedSlideData` | **必須**     | パース済みの構造化スライドデータオブジェクト。 |
| `mode`       | `'fit'            | 'scroll'`    | `'fit'`                                        | `'fit'`: 特定ページのみをコンテナに収まるよう表示。<br> |

<br>`'scroll'`: 全ページを縦に並べて表示。 |
| `currentPageIndex` | `number` | `0` | `mode="fit"` の時に表示するスライドのインデックス（0始まり）。 |
| `width` | `string` | `'100%'` | コンポーネント外枠の幅。CSSで有効な単位（`%`, `px`, `vw`等）が指定可能。 |
| `height` | `string` | `'100%'` | コンポーネント外枠の高さ。CSS単位のほか、`'fit-content'` を指定するとスライドの縮小後の高さに自動追従します。 |

---

## 開発とテスト

本コンポーネントは **Vitest** による厳密なテスト駆動のもと設計されています。環境依存（JSDOM で `ResizeObserver` が未定義になる問題など）や Svelte 5 のルーン規則（`rune_outside_svelte`）をクリアするための仕組みが盛り込まれています。

### テストの実行

テストファイルは Svelte 5 コンパイラにルーンを認識させるため、拡張子を `.test.svelte.ts` としています。

```bash
# vitestの実行 (Bun環境)
bun vitest

```

### 考慮されているエッジケース（テスト済）

- **コンテナサイズ 0 のハンドリング:** 非表示のタブやアコーディオン内に配置され、一時的に `clientWidth/Height` が 0 になった際も、ゼロ除算による `NaN` や `Infinity` の発生を防ぎ、安全なスケール倍率（`1`）にフォールバックします。
- **不正なインデックスへの耐性:** 存在しないページ番号（負の数や配列長以上のインデックス）が Props から渡された場合も、クラッシュせず安全に白画面を維持します。
- **アクセシビリティ (a11y):** Svelteコンパイラの支援技術警告をクリアするため、すべての `iframe` に適切な `title` 属性を動的に付与しています。
