# KeyboardEventRegistry

`KeyboardEventRegistry` は、Svelte 5（Runes）ベースのデスクトップアプリケーション向けに設計された、強力で柔軟なキーボードショートカット管理モジュールです。

フォーカスがどこにあっても意図した画面のショートカットを動作させる「アクティブスタック方式」**と、イベントの衝突を防ぎつつ親要素へ伝播させる**「仮想バブリング」の仕組みを提供します。

---

## 主な特徴

- **OSの差異を吸収 (`mod` キー):** Macの `Command` キーと Windows/Linuxの `Control` キーを `mod` という表記1つで自動的に判別・吸収します。
- **3つの優先度レイヤー:** ショートカットを `modal` / `view` / `global` の3層に分離し、常に最前面のコンテキストが最優先でキーを捕捉します。
- **仮想バブリングの制御:** 各アクションのコールバックで `true` を返すと、それ以降の下位レイヤーへのイベント伝播（バブリング）をその場でストップできます。
- **入力フォームでの暴発防止:** ユーザーがテキスト入力欄（`input`, `textarea`, `contenteditable`）で文字入力やバックスペースを行っている間は、ショートカットの誤作動を自動で防止します（`Ctrl+S` などのコンビネーションキーは有効に機能します）。

---

## 導入・設定

まずはアプリケーションのルート（例: `App.svelte` やレイアウトコンポーネント）でレジストリを初期化し、コンテキストに登録します。

```html
<script lang="ts">
  import { setContext } from "svelte";
  import {
    KeyboardEventRegistry,
    KEYBOARD_REGISTRY_KEY,
  } from "./keyboardEventRegistry.svelte";

  // レジストリのインスタンス化（自動的に window の keydown 聴取が開始されます）
  const keyboardRegistry = new KeyboardEventRegistry();
  setContext(KEYBOARD_REGISTRY_KEY, keyboardRegistry);
</script>

<slot />
```

---

## 基本的な使い方

各コンポーネントや画面では、Svelte 5のライフサイクル（`onMount`）を利用してショートカットを登録・有効化します。

### 1. ビュー（画面）での登録例

```html
<script lang="ts">
  import { onMount, getContext } from "svelte";
  import {
    KEYBOARD_REGISTRY_KEY,
    type KeyboardEventRegistry,
  } from "./keyboardEventRegistry.svelte";

  const registry = getContext<KeyboardEventRegistry>(KEYBOARD_REGISTRY_KEY);
  const SCOPE_ID = "editor-view";

  onMount(() => {
    // 1. スコープとアクションの登録
    registry.register(SCOPE_ID, {
      layer: "view",
      actions: [
        {
          key: "mod+s", // Mac: Cmd+S, Win: Ctrl+S
          action: (e) => {
            saveDocument();
            return true; // 仮想バブリングをここで停止（消費完了）
          },
        },
        {
          key: "escape",
          action: () => {
            closeEditor();
            // 戻り値を省略するか、false を返すと、下位（globalなど）にもイベントが流れます
          },
        },
      ],
    });

    // 2. このスコープをアクティブ（最前面）にする
    registry.activate(SCOPE_ID);

    // 3. アンマウント時にクリーンアップ
    return () => {
      registry.unregister(SCOPE_ID);
    };
  });
</script>

<div data-shortcut-scope="{SCOPE_ID}" class="editor-container">
  <textarea placeholder="ここに文字を入力..."></textarea>
</div>
```

### 2. モーダルでの登録例

モーダル要素を表示する際は、`layer: 'modal'` として登録します。これにより、背後にある `view` や `global` のショートカットを完全にシャットアウト（または優先して処理）できます。

```typescript
registry.register("confirm-modal", {
  layer: "modal",
  actions: [
    {
      key: "enter",
      action: () => {
        executeConfirm();
        return true;
      },
    },
  ],
});
registry.activate("confirm-modal");
```

---

## 仕様詳細

### 優先度順位（評価の仕組み）

キーボードイベントが発生すると、レジストリは以下の順番で登録されたアクションを走査します。

1. **Modalレイヤー:** `modalStack` の最新（最前面）のモーダルスコープ
2. **Physical Focus（物理フォーカス）:** イベントの発生元（`event.target`）の直近にある `data-shortcut-scope`
3. **Viewレイヤー:** `viewStack` の最新（アクティブ）の画面スコープ
4. **Globalレイヤー:** アプリ全体共通のスコープ

### キー表記ルール

`key` に指定する文字列はすべて小文字で記述します。

- 単一キー: `'escape'`, `'enter'`, `'a'`, `'f1'`
- コンビネーション: `'ctrl+z'`, `'shift+alt+arrowup'`
- デスクトップ最適化: `'mod+c'`（OSに応じて `meta+c` または `ctrl+c` に置換）
