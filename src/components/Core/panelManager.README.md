# README.md

# @core/panel-manager

Svelte 5（Runes）を最大限に活かした、軽量かつ型安全なマルチペイン（パネル）管理モジュールです。
「ポータブルな単一HTMLビューアー」から「デスクトップ版の多機能エディタ」まで、コードベースを汚すことなくシームレスにレイアウトを切り替えることができます。

## 特徴

- **Svelte 5 Runes 完全対応:** パネルの状態（開閉、サイズ）がリアクティブに制御され、最小限の再レンダリングで高速に動作します。
- **本物のコンポーネントを内包:** 各パネルは独立したSvelteコンポーネントとしてマウントされるため、内部で独自の `$state` やライフサイクル（`onMount` 等）がフルに使用可能です。
- **安全なメモリ解放 (Anti-Memory-Leak):** `unregister` メソッドのコールにより、内部コンポーネントの参照を完全に断ち切り、JavaScriptのガベージコレクションへ安全に引き渡します。
- **依存関係ゼロ:** 外部の巨大なドラッグ＆ドロップ、リサイズライブラリは一切不要。単一HTML成果物の軽量化に貢献します。

## API リファレンス

### `PanelManager` クラス

パネルの状態を一括管理する中心的なクラスです。

#### メソッド

- `register(panel: PanelState): void`
  新しいパネルをマネージャーに登録します。同一の `id` が既に存在する場合はスキップされます。
- `unregister(id: string): void`
  指定された `id` のパネルをマネージャーから完全に削除し、マウントされているコンポーネントを破棄します。
- `togglePanel(id: string): void`
  パネルの表示・非表示（`isOpen`）を反転させます。
- `updateWidth(id: string, width: number): void`
  パネルの横幅（ピクセル）を更新します（最小幅 100px が保証されます）。

---

## 導入方法・実装例

### 1. マネージャーの初期化とコンテキスト配置

アプリケーションの親コンポーネント（例: `MainLayout.svelte`）で、マネージャーの初期化と子コンポーネントへのコンテキスト配布を行います。

```html
<script lang="ts">
  import { setContext } from "svelte";
  import { PanelManager, PANEL_MANAGER_KEY } from "./panelManager.svelte";
  import Panel from "./Panel.svelte";

  // 各自のロジックを持つ独立したコンポーネント
  import OutlinePanel from "./panels/OutlinePanel.svelte";
  import PreviewPanel from "./panels/PreviewPanel.svelte";

  const panelManager = new PanelManager();
  setContext(PANEL_MANAGER_KEY, panelManager);

  // コンポーネントを直接登録
  panelManager.register({
    id: "outline",
    title: "OUTLINE",
    component: OutlinePanel,
    isOpen: true,
    width: 260,
  });

  panelManager.register({
    id: "preview",
    title: "PREVIEW",
    component: PreviewPanel,
    isOpen: true,
    width: 640,
  });
</script>

<div class="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-950">
  {#each panelManager.panels as panel (panel.id)}
  <Panel {panel} />
  {/each}
</div>
```

### 2. パネル描画の抽象化コンポーネント

各パネルのガワ（ヘッダーや枠線）と、動的なコンポーネントのマウントを処理する共通コンポーネントです。

```html
<script lang="ts">
  import type { PanelState } from "./panelManager.svelte";

  interface Props {
    panel: PanelState;
  }

  let { panel }: Props = $props();
  let componentInstance = $state();
</script>

{#if panel.isOpen}
<div
  class="flex flex-col border-r border-gray-200 dark:border-gray-800"
  style="width: {panel.width}px;"
>
  <div
    class="flex h-10 items-center px-4 border-b border-gray-100 dark:border-gray-800"
  >
    <span class="text-xs font-bold text-gray-400">{panel.title}</span>
  </div>

  <div class="flex-1 overflow-auto">
    {#component panel.component bind:this={componentInstance} {...panel.props}
    /}
  </div>
</div>
{/if}
```

### 3. 動的ロードとメモリ解放（デスクトップ専用パネルなどの例）

特定のモードでのみ表示させたい重いパネル（例: 設定画面、リッチエディタなど）は、ライフサイクルイベントに合わせてオンデマンドで登録・完全破棄を切り替えます。

```html
<script lang="ts">
  import { onMount, getContext } from "svelte";
  import { PANEL_MANAGER_KEY, type PanelManager } from "./panelManager.svelte";
  import HeavyEditorPanel from "./HeavyEditorPanel.svelte";

  const panelManager = getContext<PanelManager>(PANEL_MANAGER_KEY);
  const PANEL_ID = "heavy-editor";

  onMount(() => {
    // 必要な時に初めて登録・マウント
    panelManager.register({
      id: PANEL_ID,
      title: "EDITOR",
      component: HeavyEditorPanel,
      isOpen: true,
      width: 500,
    });

    // アンマウント（使い終わり）時に確実にメモリから解放
    return () => {
      panelManager.unregister(PANEL_ID);
    };
  });
</script>
```

---

# パネル管理システム（Panel Management System）詳細仕様書

## 1. 概要

本仕様書は、ポータブルワンファイルHTML（閲覧専用スライドビューアー）およびデスクトップ版（エディタ＆ビューアー）の双方に対応する、軽量かつ柔軟なレイアウト制御のためのパネル管理システムの仕様を定義する。
Svelte 5のRunes（リアクティブシステム）をコアに据え、外部の巨大な画面分割ライブラリに依存せず、最小限のフットプリントでマルチペインレイアウトを実現する。

---

## 2. 設計原則

- **ゼロ・外部依存 (Zero-dependency):** ポータブル版のファイルサイズ制約を満たすため、純粋なCSS（Flexbox/Grid）とSvelte標準機能のみで完結させる。
- **コンポーネント中心主義 (Component-Driven):** 各パネルの中身は完全なSvelteコンポーネントとして扱い、内部に独自の状態（`$state`）やライフサイクルを持たせる。
- **厳格なライフサイクル管理 (Strict Lifecycle):** パネルの動的な追加・削除時にメモリリークを引き起こさないよう、明示的な登録解除と参照破棄を強制する。

---

## 3. アーキテクチャとデータ構造

システムは、状態を管理する純粋なTypeScriptクラス（`PanelManager`）と、それを描画するSvelteコンポーネント（`Panel.svelte`）の2層で構成される。

### 3.1 データ定義 (Interfaces)

#### `PanelState`

1つのパネルのメタデータ、状態、および描画対象のコンポーネントを保持するオブジェクト。

| プロパティ  | 型                    | 必須 | 概要                                             |
| ----------- | --------------------- | ---- | ------------------------------------------------ |
| `id`        | `string`              | Yes  | パネルを識別する一意の識別子。                   |
| `component` | `Component<any>`      | Yes  | レンダリング対象のSvelte 5コンポーネント。       |
| `props`     | `Record<string, any>` | No   | コンポーネントの初期化時に渡されるプロパティ。   |
| `title`     | `string`              | Yes  | パネルヘッダーに表示されるタイトル文字列。       |
| `isOpen`    | `boolean`             | Yes  | パネルの表示（展開）／非表示（折りたたみ）状態。 |
| `width`     | `number`              | Yes  | パネルの横幅（ピクセル単位）。                   |

---

## 4. コア機能とメカニズム

### 4.1 仮想レイアウトと動的マウント

`PanelManager` が管理する `#panels` 配列（内部リアクティブステート）の変更を検知し、レイアウトコンポーネントが `{#each}` ループを用いて動的に要素を生成する。コンポーネントの描画には Svelte 5 の `{#component}` 構文を使用し、`props` の動的バインディングおよび `bind:this` によるインスタンス参照の取得を可能にする。

### 4.2 メモリ管理とガベージコレクション（GC）

コンポーネントが不要になった際、単に `isOpen = false` にするだけでは、コンポーネントのインスタンスや内部のイベントリスナー、状態がメモリ上に維持され続ける（非表示なだけで生存）。
これを完全に防ぐため、以下の2段階の破棄プロセスを実行する。

1. **マネージャー配列からの削除:** `unregister(id)` が実行されると、内部配列が新しい配列へフィルタリング（再生成）される。
2. **参照の切断とGCの誘発:** 配列から除外されることで、Svelteの `{#each}` および `{#component}` の評価から外れ、対象コンポーネントが完全にアンマウント（DOMおよび仮想DOMからの消去、`$effect` のクリーンアップ）される。これにより、すべてのルート参照が切断され、ブラウザのガベージコレクションの対象となる。
