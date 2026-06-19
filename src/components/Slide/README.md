拡張した `onkeydown` プロパティの仕様と、それに伴うライフサイクル（イベントリスナーの管理）のアップデートを反映した新しい `README.md` です。

マークダウンのテーブル構造をクリーンに整形し、特徴およびエッジケースの記述にキーボードイベントの確実なリレーとクリーンアップに関する詳細を追記しています。そのまま上書きしてご活用ください。

````markdown
# SlideCanvas

`SlideCanvas` は、Markdown-it などのパーサーによって生成されたスライドの HTML テキストを、アプリケーション側のスタイル（Tailwind CSS 等）から完全に隔離してレンダリングするための Svelte 5 専用コンポーネントです。

内部で `<iframe>` を利用した独立空間を生成し、かつ `$effect` とネイティブの `innerHTML` を組み合わせることで、Svelte の差分検知オーバーヘッドを排除した最高速の描画パフォーマンスを実現しています。

## 特徴

- 🛡️ **完全なスタイル隔離:** `iframe` による独立文書空間により、メインアプリの Tailwind CSS（Preflight 等）によるデザイン破壊を 100% 防ぎます。
- 📐 **アスペクト比を維持した自動スケーリング:** スライド本来のレンダリング解像度を自動計測し、親コンテナのサイズに合わせて `transform: scale()` を用いた歪みのないフィッティングを行います。
- ⚡ **動的なスクロールレンダリング最適化 (`content-visibility`):** `mode="scroll"` 時は `content-visibility: auto` を自動適用。プレースホルダーサイズ（`contain-intrinsic-size`）を計測されたスライド解像度に動的に追従させることで、画面外ページの描画コストをスキップしつつ、スクロールバーのガタつきやレイアウトシフトを極限まで抑えます。
- 🔄 **ステートベースのスクロール双方向同期:** `mode="scroll"` 時において、外部の Props と `iframe` 内部のスクロール位置（`scrollTop`）の双方向同期に対応。タイマー（`setTimeout`）や一時的な制御フラグに依存せず、純粋なステートの差分検知ガードと `requestAnimationFrame` により、チャタリング（無限ループ）のない滑らかな同期を実現します。
- ⌨️ **隔離空間からのキーボードイベント・リレー:** スタイル隔離の代償として親ウィンドウへ伝播（バブリング）しなくなる `iframe` 内部のキーボードイベント（`keydown`）を確実に捕捉し、Props 経由で親コンポーネントへ透過的にリレーします。これにより、別ウィンドウ同期やプレゼンテーション制御を損ないません。
- 🧩 **1ファイル完結型・堅牢なマルチエフェクト設計:** 状態初期化（各種リスナー登録含む）、DOMの再構築、外部同期のライフサイクルを Svelte 5 のルールに則り 3つの `$effect` に最適に分離。エフェクトの不要な再トリガーやイベントリスナーの消失・リークといった特有のバグを排除しています。

---

## データ構造 (`ParsedSlideData`)

スライドデータは、コンポーネントに渡す前に以下のような構造化文字列データにパースして保持してください。

```typescript
export interface ParsedSlideData {
  // <div class="slides"> 自体に付与するクラスやデータ属性のマップ
  containerAttrs: Record<string, string>;

  // スライド直下に配置される、全ページ共通のスタイルタグ等
  commons: string[];

  // 各 <section class="page">...</section> の outerHTML 文字列の配列
  pages: string[];
}
```
````

---

## 使い方

### 1. 基本的な実装例（1ページフィット表示 ＆ キーボードナビゲーション）

```svelte
<script lang="ts">
  import SlideCanvas from './components/Slide/SlideCanvas.svelte';
  import type { ParsedSlideData } from './types/slide';

  const slideData: ParsedSlideData = {
    containerAttrs: { class: 'slides-container' },
    commons: ['<style>@scope { section.page { width: 1920px; height: 1080px; background: #fff; } }</style>'],
    pages: [
      '<section class="page" id="slide-1"><h1>表紙</h1></section>',
      '<section class="page" id="slide-2"><h1>2ページ目</h1></section>'
    ]
  };

  let currentPage = $state(0);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') currentPage++;
    if (e.key === 'ArrowLeft' && currentPage > 0) currentPage--;
  }
</script>

<div class="editor-preview-area">
  <SlideCanvas
    data={slideData}
    mode="fit"
    currentPageIndex={currentPage}
    width="100%"
    height="100%"
    onkeydown={handleKeyDown}
  />
</div>
```

### 2. 縦並びスクロール表示 & スクロール位置の双方向同期

タイムラインや別パネルとスクロール位置を同期させたい場合の指定方法です。

```svelte
<script lang="ts">
  import SlideCanvas from './components/Slide/SlideCanvas.svelte';
  import type { ParsedSlideData } from './types/slide';

  let { slideData } = $props<{ slideData: ParsedSlideData }>();

  let currentScrollTop = $state(0);
</script>

<div class="sync-container">
  <div class="status">Current Scroll: {currentScrollTop}px</div>

  <SlideCanvas
    data={slideData}
    mode="scroll"
    width="100%"
    height="100%"
    bind:scrollTop={currentScrollTop}
  />
</div>
```

---

## API リファレンス

### Props

| プロパティ名       | 型                           | デフォルト値 | 説明                                                                                                                       |
| :----------------- | :--------------------------- | :----------- | :------------------------------------------------------------------------------------------------------------------------- |
| `data`             | `ParsedSlideData`            | **必須**     | パース済みの構造化スライドデータオブジェクト。                                                                             |
| `mode`             | `'fit' \| 'scroll'`          | `'fit'`      | `'fit'`: 特定ページのみをコンテナに収まるよう表示。<br>`'scroll'`: 全ページを縦に並べて表示（`content-visibility` 有効）。 |
| `currentPageIndex` | `number`                     | `0`          | `mode="fit"` の時に表示するスライドのインデックス（0始まり）。                                                             |
| `width`            | `string`                     | `'100%'`     | コンポーネント外枠の幅。CSSで有効な単位（`%`, `px` 等）が指定可能。                                                        |
| `height`           | `string`                     | `'100%'`     | コンポーネント外枠の高さ。`'fit-content'` を指定するとスライドの縮小後の高さに自動追従。                                   |
| `scrollTop`        | `number`                     | `0`          | `mode="scroll"` 時のスクロール位置（px）。`bind:scrollTop` による双方向バインドが可能。                                    |
| `onscroll`         | `(value: number) => void`    | `undefined`  | `mode="scroll"` 時、スクロール位置が変更された際に呼び出されるコールバック関数。                                           |
| `onkeydown`        | `(e: KeyboardEvent) => void` | `undefined`  | `iframe` 内部でキーボードイベント（`keydown`）が発生した際に呼び出されるコールバック関数。                                 |

---

## 開発とテスト

本コンポーネントは **Vitest** による厳密なテスト駆動のもと設計されています。Svelte 5 のルーン規則や、`iframe` 特有のライフサイクルを安全にハンドリングするための仕組みが盛り込まれています。

### 考慮されているエッジケース（テスト済）

- **双方向同期の無限ループ防止（決定論的ガード）**: 外部 Props（`scrollTop`）経由の同期と、`iframe` 内部のネイティブスクロールイベントの循環発火を防ぐため、タイマーやフラグ（`isInternalUpdating` 等）を使用せず、**純粋な値の閾値差分チェック**のみで完全にシャットアウトします。これにより非同期処理のタイミングに左右されない極めて安定した同期を実現します。
- **高頻度イベントの間引き**: `iframe` 内のスクロールイベントは `passive: true` でリスナーを登録し、`requestAnimationFrame` (rAF) を用いてブラウザの描画フレームと同期させて親へ通知するため、スクロールパフォーマンスを低下させません。
- **マルチエフェクトによるバグ・リークの排除**: 状態の更新が別セクションに悪影響を及ぼさないよう、役割ごとに `$effect` を細かく分離。計測完了フラグ（`hasMeasured`）の書き換えによってスクロールやキーダウンのイベントリスナーが予期せず解除・消失してしまうエッジケースを解決し、クリーンアップ関数による確実なリスナー解除でメモリリークを防ぎます。
- **コンテナサイズ 0 のハンドリング**: 非表示のタブやアコーディオン内に配置され、一時的に `clientWidth/Height` が 0 になった際も、ゼロ除算による `NaN` や `Infinity` の発生を防ぎ、安全なスケール倍率（`1`）にフォールバックします。
- **アクセシビリティ (a11y)**: Svelte コンパイラの支援技術警告をクリアするため、`iframe` に適切な `title` 属性（`title="Slide Render Space"`）を付与しています。

```

```
