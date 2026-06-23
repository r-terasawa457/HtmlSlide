# NavBar コンポーネント

`NavBar` は、アプリケーション共通のヘッダーとして機能しながら、現在表示されている子コンポーネント（各画面）から動的にコントロールやアクションを注入できる、ハイブリッド設計のナビゲーションバーです。

Svelte 5の **Runes（`$state`）** と **Snippets** を活用し、リアクティブかつ型安全に画面ごとのコンテキスト操作を実現します。

---

## 構造

Tailwind 4.3のFlexboxを使用し、3つのエリアで構成されています。

| エリア            | 管理パターン                           | 主な用途                                         |
| ----------------- | -------------------------------------- | ------------------------------------------------ |
| **左側 (Left)**   | 静的（App / Nav自身が固定制御）        | アプリロゴ、戻るボタン、固定メニュー             |
| **中央 (Center)** | **Snippet + Context パターン**         | 画面ごとのカスタムUI（検索窓、タブ等）           |
| **右側 (Right)**  | **データ駆動（Shared State）パターン** | 画面ごとのアクション（保存、削除、キャンセル等） |

---

## 構成ファイル

```text
src/components/NavBar/
├── NavBar.svelte          # ナビゲーションバーのUIコンポーネント
├── navigation.svelte.ts   # 状態管理レジストリクラス・Contextキー定義
└── test/
    ├── navBar.test.ts     # コンポーネントの統合テスト
    └── navigation.test.ts # レジストリのユニットテスト

```

---

## 使い方

### 1. 親コンポーネントでのセットアップ (`App.svelte` など)

ルートに近いコンポーネントで `NavigationRegistry` をインスタンス化し、Contextに登録します。

```svelte
<script lang="ts">
  import { setContext } from 'svelte';
  import { NavigationRegistry, NAVIGATION_KEY } from './components/NavBar/navigation.svelte';
  import NavBar from './components/NavBar/NavBar.svelte';

  // レジストリの初期化
  const navRegistry = new NavigationRegistry();
  setContext(NAVIGATION_KEY, navRegistry);
</script>

<div class="min-h-screen bg-gray-50 dark:bg-gray-950">
  <NavBar />

  <main>
    </main>
</div>

```

### 2. 子コンポーネントからのコントロール登録

子コンポーネントのマウント時にコントロールを登録し、アンマウント（画面遷移等）時にクリーンアップします。Svelte 5の `$effect` の返り値（クリーンアップ関数）を利用することで、安全に制御できます。

```svelte
<script lang="ts">
  import { getContext } from 'svelte';
  import { NAVIGATION_KEY, type NavigationRegistry } from '../NavBar/navigation.svelte';

  const nav = getContext<NavigationRegistry>(NAVIGATION_KEY);

  let query = $state('');
  let isProcessing = $state(false);

  // 1. 中央領域のUI（Snippet）を登録
  $effect(() => {
    nav.centerContent = centerSnippet;
    return () => {
      nav.centerContent = null; // アンマウント時にクリア
    };
  });

  // 2. 右側領域のアクション（データ駆動）を登録
  // 依存するState（query, isProcessing）の変化に応じて自動でNavバー側も更新されます
  $effect(() => {
    nav.rightActions = [
      {
        id: 'save',
        label: isProcessing ? '処理中...' : '保存',
        variant: 'primary',
        disabled: isProcessing || query.trim() === '',
        action: () => {
          isProcessing = true;
          // 保存処理など
        }
      }
    ];
    return () => {
      nav.rightActions = []; // アンマウント時にクリア
    };
  });
</script>

{#snippet centerSnippet()}
  <input
    type="text"
    bind:value={query}
    placeholder="この画面内を検索..."
    class="w-full max-w-md rounded-md border border-gray-300 bg-white px-3 py-1 text-sm dark:border-gray-700 dark:bg-gray-800"
  />
{/snippet}

<div class="p-6">
  </div>

```

---

## API リファレンス

### `NavigationRegistry` (Class)

状態を保持するリアクティブなレジストリクラスです。

- **`centerContent: Snippet | null`**
  中央エリアに描画するSvelteスニペットを指定します。
- **`rightActions: NavAction[]`**
  右側エリアに並べるボタンの配列を指定します。

### `NavAction` (Interface)

右側のアクションボタンを定義するオブジェクトの型です。

```ts
interface NavAction {
  id: string; // 識別用ユニークID
  label: string; // ボタンの表示テキスト
  variant?: "primary" | "secondary" | "danger"; // ボタンのデザイン系統 (デフォルト: secondary)
  disabled?: boolean; // 非活性フラグ
  action: () => void; // クリック時のコールバック関数
}
```

---

## テストの実行

本コンポーネントは Bun + Vitest + JSDOM 環境でテストが構築されています。

```bash
# テストの実行（Watchモード）
bun test

# 単発実行
bun run test:run

```
