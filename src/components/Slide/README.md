# SlideCanvas

`SlideCanvas` は、Markdown-it などのパーサーによって生成されたスライドの HTML テキストを、アプリケーション側のスタイルから完全に隔離してレンダリングするための Svelte 5 専用高性能コンポーネントです。

内部で `<iframe>` を利用した独立空間を維持しつつ、**「ハイブリッド同期（ダミースクロール）方式」** を採用することで、ブラウザ標準の美しいスクロール挙動、自由なズーム（スケーリング）、および `content-visibility` による描画コスト削減をすべて同時に実現しています。

さらに、複数端末・異画面解像度間での厳密な同期ニーズを満たすため、**「等倍ビューポート包含同期（Viewport Containment）」** 機能を搭載しています。

---

## 特徴とパフォーマンス最適化

- 🛡️ **完全なスタイル隔離:** `iframe` による独立文書空間により、メインアプリの CSS（Tailwind CSS の Preflight 等）によるデザイン破壊を 100% 防ぎます。
- 📜 **ハイブリッド・ダミースクロール構造:** スクロールバーの管理を親コンテナに移譲。拡大・縮小（`scale`）適用後の総サイズを持つ透明なダミー要素でスクロールバーを出現させつつ、親のスクロール座標を等倍に逆算して `iframe` 内部へ同期します。これにより、拡縮によってスクロールバーの太さが変わる問題を解決しています。
- ⚙️ **スクロールバー自動予測と有効内寸アラインメント:** 縦スクロールバーの出現を数学的に先回りして予測し、有効表示領域の内寸（`effectiveDimensions`）を算出。この内寸を基準に「自動スケール」と「中央寄せ（オフセット座標）」の双方を計算するため、フィット表示時にスライドがスクロールバーの裏側に重なって隠れてしまう問題を本質的に解消しています。
- 📦 **等倍ビューポート包含同期（Viewport Containment）:** コンテナサイズや画面アスペクト比が異なる端末（例: 発表者のPCとプロジェクター画面）間で `mode: 'scroll'` を同期する際、物理的な左上座標ではなく「等倍空間における表示矩形（中心点と幅・高さ）」を基準に同期します。視聴者側のコンテナサイズに合わせてスケールとスクロール位置を自動逆算し、発表者が見ている範囲を完全に画面内に内包（contain）させるため、表示領域の破綻や見切れが絶対に発生しません。
- ⚡ **`content-visibility` の完全動作:** `iframe` 自体は常に親の表示領域（ビューポート）サイズに固定され、内部のドキュメントが実際に `scrollTo` でシームレスにスクロールするため、画面外ページの描画コストをスキップする `content-visibility: auto` が完全に機能します。
- 🚀 **DOMの即時同期と状態更新の間引き（ハイブリッド・レート制御）:** スクロール追従のカクつき（遅延）を徹底的に排除するため、DOM 同士の `scrollTo` 同期はイベント発生時に**遅延なく即時実行**します。一方で、重い Svelte 5 の状態更新（`$state`）や外部へのコールバック（`onscroll`）は `requestAnimationFrame` (rAF) を用いてブラウザの描画フレームレートに**間引く**ことで、吸い付くような滑らかさとキビキビとした軽快な操作感を両立しています。
- 🛡️ **スケール適応型の許容誤差と二重同期バイパス:** 外部 Props 経由の同期と、コンテナ/iframe 内のネイティブスクロールイベントの循環発火（フィードバックループ）を防ぐため、スケールに応じた動的な許容誤差（`Math.max(1.5, scale)`）と内部更新追跡によるガードを搭載。サブピクセルの丸め誤差によるガタつきやジッターを完全に遮断します。
- 🎯 **`currentPageIndex` の双方向同期とスマートスナップ:** `mode: 'scroll'`（スクロール表示）において、スクロール位置に応じた最新のページインデックスが `currentPageIndex` へ自動同期されます。また、外部から `currentPageIndex` が変更された際（または `mode` 切り替え時）は、該当スライドの先頭へ自動スナップスクロールします。ユーザーのスクロール中はスナップを一時抑制するガードを搭載し、滑らかな自由スクロールを維持します。
- 🔴 **スマート・レーザーポインター消去仕様:** 発表者のマウスカーソルが1pxでもスライドの有効領域外に出た場合、または `mouseleave` が発生した場合は、座標を境界線上にクリップせず、自動的に無効値（`-1`）へフォールバックします。これにより、別端末の同期画面も含めてポインターが領域外で不自然に残り続ける現象を排除し、自然な消去挙動を実現しています。
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
  containerAttrs: Record<string, string>;
  commons: string[];
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

### 2. スクロール表示 ＆ 等倍ビューポート追従同期（遠隔同期ビュアー環境）

```svelte
<script lang="ts">
  import SlideCanvas from './components/Slide/SlideCanvas.svelte';
  import type { ParsedSlideData } from './types';

  let { slideData, isPresenter, remoteViewport } = $props<{
    slideData: ParsedSlideData;
    isPresenter: boolean;
    remoteViewport?: { centerTop: number; centerLeft: number; width: number; height: number };
  }>();

  let currentScale = $state(1.0);
  let scrollTop = $state(0);
  let scrollLeft = $state(0);

  // 外部への同期用ブロードキャスト関数（仮想）
  import { broadcastViewport } from './syncSystem';
</script>

<div class="viewer-container">
  <SlideCanvas
    data={slideData}
    mode="scroll"
    fit_mode={isPresenter ? "none" : "contain"}
    scrollbarMode={isPresenter ? "auto" : "hidden"}
    bind:scale={currentScale}
    bind:scrollTop={scrollTop}
    bind:scrollLeft={scrollLeft}
    syncUnscaledViewport={isPresenter ? undefined : remoteViewport}
    isPresenter={isPresenter}
    width="100%"
    height="100%"
    onscroll={(top, left, info) => {
      // 発表者側の場合、等倍空間の表示矩形（info）をリアルタイムにシリアライズして送信
      if (isPresenter && info) {
        broadcastViewport({
          centerTop: info.unscaledCenterTop,
          centerLeft: info.unscaledCenterLeft,
          width: info.unscaledWidth,
          height: info.unscaledHeight
        });
      }
    }}
  />
</div>

```

---

## API リファレンス

### Props

| プロパティ名           | 型                                                                                                                                                     | デフォルト値 | 説明                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`                 | `ParsedSlideData`                                                                                                                                      | **必須**     | パース済みの構造化スライドデータオブジェクト。                                                                                                                                                       |
| `mode`                 | `'scroll'                                                                                                                                              | 'slide'`     | `'slide'`                                                                                                                                                                                            | 表示モード。`'scroll'`: 全ページを縦に並べて連続スクロール表示。`'slide'`: 指定ページのみを表示。                                                                                                             |
| `fit_mode`             | `'contain'                                                                                                                                             | 'width'      | 'none'`                                                                                                                                                                                              | `'contain'`                                                                                                                                                                                                   | スケールの自動計算ルール。`'contain'`: 枠内に完全に収まるよう縮小。`'width'`: 横幅をコンテナの幅にジャストフィット。`'none'`: 自動計算を無効化し、`scale` の値を外部から直接制御。 |
| `currentPageIndex`     | `number`                                                                                                                                               | `0`          | **双方向バインド**。表示中のページインデックス。`mode:'scroll'` では現在のスクロール位置に応じたインデックスが自動同期され、外部からのインデックス変更時は該当ページへ自動スナップスクロールします。 |
| `scale`                | `number`                                                                                                                                               | `1.0`        | **双方向バインド**。スライドの現在のズーム倍率。`fit_mode` が `none` 以外のとき、および `syncUnscaledViewport` 同期時は自動計算された最新の倍率がこの変数に同期されます。                            |
| `width`                | `string`                                                                                                                                               | `'100%'`     | コンポーネント外枠の幅。`'fit-content'` 指定時はスライドの縮小後の物理幅に自動追従。                                                                                                                 |
| `height`               | `string`                                                                                                                                               | `'100%'`     | コンポーネント外枠の高さ。`'fit-content'` 指定時はスライドの縮小後の物理高さに自動追従。                                                                                                             |
| `scrollTop`            | `number`                                                                                                                                               | `0`          | **双方向バインド**。親コンテナの物理 `scrollTop`。                                                                                                                                                   |
| `scrollLeft`           | `number`                                                                                                                                               | `0`          | **双方向バインド**。親コンテナの物理 `scrollLeft`。                                                                                                                                                  |
| `scrollbarMode`        | `'always'                                                                                                                                              | 'hidden'     | 'auto'`                                                                                                                                                                                              | `'auto'`                                                                                                                                                                                                      | `mode:'scroll'` 時の縦スクロールバー制御。`'always'`: 常に表示。`'hidden'`: 表示を消す（ホイール等の操作は維持）。`'auto'`: はみ出た時のみ自動表示。                               |
| `syncUnscaledViewport` | `{ centerTop: number; centerLeft: number; width: number; height: number }                                                                              | undefined`   | `undefined`                                                                                                                                                                                          | **視聴者側専用**。同期元（発表者）の等倍空間基準ビューポート。これが渡されている場合、コンポーネントは指定された領域が自身の画面内に過不足なく収まるように `scale` とスクロール位置を自動で強制上書きします。 |
| `laserActive`          | `boolean`                                                                                                                                              | `false`      | **双方向バインド**。レーザーポインター機能の有効/無効フラグ。                                                                                                                                        |
| `laserX`               | `number`                                                                                                                                               | `0`          | **双方向バインド**。スライド全体の総内寸幅に対するレーザーの水平比率（`0.0` 〜 `1.0`）。領域外時は `-1`。                                                                                            |
| `laserY`               | `number`                                                                                                                                               | `0`          | **双方向バインド**。スライド全体の総内寸高さに対するレーザーの垂直比率（`0.0` 〜 `1.0`）。領域外時は `-1`。                                                                                          |
| `isPresenter`          | `boolean`                                                                                                                                              | `false`      | 発表者モードフラグ。`true` の場合のみ、iframe 上のマウス移動イベントをインターセプトして `laserX / Y` の絶対比率座標への計算および `onscroll` でのビューポート矩形計算を発火させます。               |
| `onscroll`             | `(top: number, left: number, info?: { unscaledCenterTop: number; unscaledCenterLeft: number; unscaledWidth: number; unscaledHeight: number }) => void` | `undefined`  | スクロール位置（親コンテナ基準）が変更された際に呼び出されるコールバック関数。発表者モード時は第3引数に等倍空間上でのビューポート情報がオブジェクトとして付与されます。                              |
| `onkeydown`            | `(e: KeyboardEvent) => void`                                                                                                                           | `undefined`  | `iframe` 内部でキーボードイベント（`keydown`）が発生した際に呼び出されるリレー用コールバック関数。                                                                                                   |
