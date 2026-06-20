# SlideCanvas

`SlideCanvas` は、Markdown-it などのパーサーによって生成されたスライドの HTML テキストを、アプリケーション側のスタイルから完全に隔離してレンダリングするための Svelte 5 専用高性能コンポーネントです。

内部で `<iframe>` を利用した独立空間を維持しつつ、**「ハイブリッド同期（ダミースクロール）方式」** を採用することで、ブラウザ標準の美しいスクロール挙動、自由なズーム（スケーリング）、および `content-visibility` による描画コスト削減をすべて同時に実現しています。

---

## 特徴とパフォーマンス最適化

- 🛡️ **完全なスタイル隔離:** `iframe` による独立文書空間により、メインアプリの CSS（Tailwind CSS の Preflight 等）によるデザイン破壊を 100% 防ぎます。
- 📜 **ハイブリッド・ダミースクロール構造:** スクロールバーの管理を親コンテナに移譲。拡大・縮小（`scale`）適用後の総サイズを持つ透明なダミー要素でスクロールバーを出現させつつ、親のスクロール座標を等倍に逆算して `iframe` 内部へ同期します。これにより、拡縮によってスクロールバーの太さが変わる問題を解決しています。
- ⚡ **`content-visibility` の完全動作:** `iframe` 自体は常に親の表示領域（ビューポート）サイズに固定され、内部のドキュメントが実際に `scrollTo` でシームレスにスクロールするため、画面外ページの描画コストをスキップする `content-visibility: auto` が完全に機能します。
- 🚀 **DOMの即時同期と状態更新の間引き（ハイブリッド・レート制御）:** スクロール追従のカクつき（遅延）を徹底的に排除するため、DOM 同士の `scrollTo` 同期はイベント発生時に**遅延なく即時実行**します。一方で、重い Svelte 5 の状態更新（`$state`）や外部へのコールバック（`onscroll`）は `requestAnimationFrame` (rAF) を用いてブラウザの描画フレームレートに**間引く**ことで、吸い付くような滑らかさとキビキビとした軽快な操作感を両立しています。
- 🛡️ **スケール適応型の許容誤差と二重同期バイパス:** 外部 Props 経由の同期と、コンテナ/iframe 内のネイティブスクロールイベントの循環発火（フィードバックループ）を防ぐため、スケールに応じた動的な許容誤差（`Math.max(1.5, scale)`）と内部更新追跡によるガードを搭載。サブピクセルの丸め誤差によるガタつきやジッターを完全に遮断します。
- 🎯 **`currentPageIndex` の双方向同期とスマートスナップ:** `mode: 'scroll'`（スクロール表示）において、スクロール位置に応じた最新のページインデックスが `currentPageIndex` へ自動同期されます。また、外部から `currentPageIndex` が変更された際（または `mode` 切り替え時）は、該当スライドの先頭へ自動スナップスクロールします。ユーザーのスクロール中はスナップを一時抑制するガードを搭載し、滑らかな自由スクロールを維持します。
- ⌨️ **隔離空間からのキーボードイベント・リレー:** スタイル隔離によって親ウィンドウへ伝播しなくなる `iframe` 内部のキーボードイベント（`keydown`）を捕捉し、Props 経由で親コンポーネントへ透過的にリレーします。

---

## HTML コンテナの階層構造と役割

コンポーネント内部は、パフォーマンス最適化とスケーリングを両立するために以下の 3 層構造で構成されています。

```

[1. .canvas-wrapper (親コンテナ)] -> overflow: auto で標準スクロールバーを提供
├── [2. .scroll-filler (ダミー要素)] -> 拡大後の総サイズを物理的に確保しバーを伸ばす
└── [3. iframe (レンダラー)] -> 表示領域（ビューポート）に固定、内部を実際にスクロール

```

1. **`.canvas-wrapper`（親コンテナ）**
   - **役割:** ユーザーが操作する実際のスクロールバーの提供、および可視表示領域（ビューポート）の限定。
2. **`.scroll-filler`（ダミー要素）**
   - **役割:** `scale` 適用後のスライド全体の物理サイズ（`width` × `scale`, `height` × `scale`）を親コンテナ内に確保し、正しい可動範囲のスクロールバーを出現させる。マウスイベントは透過（`pointer-events: none`）します。
3. **`iframe`（レンダラー）**
   - **役割:** スタイルの完全隔離、および `transform: scale()` による表示上の拡縮。物理サイズは `(ビューポート / scale)` に自動調整され、`scale` 変化時も親コンテナとぴったり重なり、内部でネイティブスクロールを発生させます。

---

## データ構造 (`ParsedSlideData`)

スライドデータは、コンポーネントに渡す前に以下のような構造化文字列データにパースして保持してください。

```typescript
export interface ParsedSlideData {
  // <div class="slides"> 自体に付与するクラスやデータ属性のマップ
  containerAttrs: Record<string, string>;

  // スライド直下に配置される、全ページ共通のスタイルタグ等の配列
  commons: string[];

  // 各 <section class="page">...</section> の outerHTML 文字列の配列
  pages: string[];
}
```

---

## 使い方

### 1. 1ページフィット表示（全画面プレゼンテーション等）

```svelte
<script lang="ts">
  import SlideCanvas from './components/Slide/SlideCanvas.svelte';
  import type { ParsedSlideData } from './types';

  const slideData: ParsedSlideData = {
    containerAttrs: { class: 'slides-container' },
    commons: ['<style>section.page { width: 1920px; height: 1080px; background: #fff; }</style>'],
    pages: [
      '<section class="page"><h1>表紙</h1></section>',
      '<section class="page"><h1>2ページ目</h1></section>'
    ]
  };

  let currentPage = $state(0);
</script>

<div class="presentation-area">
  <SlideCanvas
    data={slideData}
    mode="slide"
    fit_mode="contain"
    currentPageIndex={currentPage}
    width="100vw"
    height="100vh"
  />
</div>

```

### 2. スクロール表示 ＆ 自由なズーム・スクロール同期（PDFビュアー風）

```svelte
<script lang="ts">
  import SlideCanvas from './components/Slide/SlideCanvas.svelte';
  import type { ParsedSlideData } from './types';

  let { slideData } = $props<{ slideData: ParsedSlideData }>();

  let currentScale = $state(1.0);
  let scrollTop = $state(0);
  let scrollLeft = $state(0);
</script>

<div class="toolbar">
  <button onclick={() => currentScale += 0.1}>ズームイン</button>
  <button onclick={() => currentScale -= 0.1}>ズームアウト</button>
  <span>位置: {scrollTop}px, {scrollLeft}px</span>
</div>

<div class="viewer-container">
  <SlideCanvas
    data={slideData}
    mode="scroll"
    fit_mode="none"
    bind:scale={currentScale}
    bind:scrollTop={scrollTop}
    bind:scrollLeft={scrollLeft}
    width="100%"
    height="calc(100% - 40px)"
  />
</div>

```

---

## API リファレンス

### Props

| プロパティ名       | 型                               | デフォルト値 | 説明                                                                                                                                                                                                                     |
| ------------------ | -------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`             | `ParsedSlideData`                | **必須**     | パース済みの構造化スライドデータオブジェクト。                                                                                                                                                                           |
| `mode`             | `'scroll'                        | 'slide'`     | `'slide'`                                                                                                                                                                                                                | 表示モード。`'scroll'`:全ページを縦に並べてスクロール表示。`'slide'`:`currentPageIndex`の指定ページのみを表示。 |
| `fit_mode`         | `'contain'                       | 'width'      | 'none'`                                                                                                                                                                                                                  | `'contain'`                                                                                                     | スケールの自動計算ルール。`'contain'`:枠内に1ページが完全に収まるよう自動縮小。`'width'`:横幅をコンテナの幅にぴったり合わせる。`'none'`:自動計算を無効化し、`scale`Propsの値を直接使用。 |
| `currentPageIndex` | `number`                         | `0`          | **双方向バインド(`bind:currentPageIndex`)**。表示中のスライドインデックス。`mode:'scroll'`では、現在のスクロール位置に応じたインデックスが自動同期され、外部からのインデックス変更時は該当ページへ自動スクロールします。 |
| `scale`            | `number`                         | `1.0`        | **双方向バインド(`bind:scale`)**。スライドのスケール倍率。`fit_mode`が`none`以外の時は、自動計算された最新の倍率がこの変数に同期されます。                                                                               |
| `width`            | `string`                         | `'100%'`     | コンポーネント外枠の幅。`'fit-content'`指定時はスライドの縮小後の物理幅に自動追従。                                                                                                                                      |
| `height`           | `string`                         | `'100%'`     | コンポーネント外枠の高さ。`'fit-content'`指定時はスライドの縮小後の物理高さに自動追従。                                                                                                                                  |
| `scrollTop`        | `number`                         | `0`          | **双方向バインド(`bind:scrollTop`)**。親コンテナの`scrollTop`（スケール変形適用後の実際の物理ピクセル値）。                                                                                                              |
| `scrollLeft`       | `number`                         | `0`          | **双方向バインド(`bind:scrollLeft`)**。親コンテナの`scrollLeft`（スケール変形適用後の実際の物理ピクセル値）。                                                                                                            |
| `onscroll`         | `(top:number,left:number)=>void` | `undefined`  | スクロール位置（親コンテナ基準）が変更された際に呼び出されるコールバック関数。                                                                                                                                           |
| `onkeydown`        | `(e:KeyboardEvent)=>void`        | `undefined`  | `iframe`内部でキーボードイベント（`keydown`）が発生した際に呼び出されるリレー用コールバック関数。                                                                                                                        |
|  |

---

## 開発とテスト（考慮されているエッジケース）

本コンポーネントは **Vitest** による厳密なテスト駆動のもと設計・構築されています。

- **ハイブリッド・レート制御による最適化:** スクロールの快適性を最優先するため、DOM の物理同期を最優先（即時実行）し、状態更新と外部への発火（`onscroll`）のみを `requestAnimationFrame` (rAF) でフレームレートに同期させるという高度なレート制御を行っています。
- **ゼロ除算および非表示状態（サイズ0）のハンドリング:** 非表示のタブやアコーディオン内に配置され、一時的にコンテナの `clientWidth/Height` が `0` になった際、また `scale` が `0` に指定された際も、ゼロ除算による `NaN` や `Infinity` の発生を防ぎ、安全なフォールバック（`translate(0px, 0px) scale(1)`）を行います。
- **境界外インデックスの安全保護:** 配列長以上の `currentPageIndex` や、不完全な（`pages` が空の）オブジェクトが渡された場合も、例外をスローせず安全にフォールバック処理を行います。
- **メモリリークの排除:** 各種エフェクト（`$effect`）の役割を独立させ、クリーンアップ関数によってコンポーネント破棄時にすべてのイベントリスナー（`scroll`, `keydown`）が確実に解除されるよう設計されています。
