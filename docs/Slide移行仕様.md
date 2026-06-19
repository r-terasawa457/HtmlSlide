`SlideCanvas` 側の仕様として、**`currentPageIndex`（0始まり）がスクロール位置と双方向に完全同期（`bind:`）される**という前提で、改めて全体の確定仕様と設計上の調整事項を整理しました。

この仕様により、前回懸念していた「スクロールからのページ逆算ロジックの移植」が完全に不要となり、データフローが劇的にシンプルになります。

---

## 📌 `currentPageIndex` 双方向同期前提の確定仕様

### 1. ページインデックスの相互同期（1始まり ⇄ 0始まり）

`SlideCanvas` がスクロール位置からインデックスを自動逆算して外に通知してくれるため、上位側はそれを受け取るだけでよくなります。
ただし、Svelte 5 の `bind:` は `bind:currentPageIndex={viewerState.currentPage - 1}` のような計算式を直接バインドすることはできません。

- **仕様案（状態層での隠蔽）**:
  `ViewerState` 内部に、0始まりのインデックスを仲介するゲッター/セッター（プロパティ）を1つ用意します。

```typescript
// ViewerState.svelte.ts 内のイメージ（※実装ではなく仕様の定義）
get currentPageIndex() {
  return this.modeContexts[this.currentMode].currentPage - 1;
}
set currentPageIndex(index: number) {
  this.modeContexts[this.currentMode].currentPage = index + 1;
}

```

これにより、`ViewerMain` 側では以下のようにシンプルに直結（双方向バインド）させるだけで、1始まりと0始まりの変換が安全に裏側で行われます。

```svelte
<SlideCanvas bind:currentPageIndex={viewerState.currentPageIndex} ... />

```

### 2. データフローとパース処理の共通化

- **`ViewerState` でのデータ保持**:
  `ViewerState` 内に `$derived` を配置し、`appState.slidesHtml` から `ParsedSlideData` をリアクティブに自動生成して保持します。
- **複製画面（StageViewMain）への同期**:
  `ViewerMain` から `StageViewMain` へのメッセージ送信時、このパース済みの `SlideData` オブジェクトをそのまま送信します。受け手側（ラッパーなしの `StageViewMain`）も、送られてきたデータをそのまま `SlideCanvas` に流し込み、`bind:currentPageIndex` で同期します。

### 3. ズーム・レイアウト計算の連動

`ViewerState.zoomMode` と `SlideCanvas.fit_mode` を以下のようにマッピングします。

- `FIT_WIDTH` ➔ `fit_mode="width"` （`SlideCanvas` が計算した倍率が `currentZoom` に逆同期）
- `FIT_HEIGHT` ➔ `fit_mode="contain"` （`SlideCanvas` が計算した倍率が `currentZoom` に逆同期）
- `ORIGINAL` / `CUSTOM` ➔ `fit_mode="none"` （`ViewerState` 側の数値を `SlideCanvas` へ流し込み）

### 4. イベントハンドリングの責務分離

- **`ViewerMain`（親ウィンドウ）**:

`window` のキーイベントおよび `SlideCanvas` からリレーされる `onkeydown` コールバックを一括して受け止め、`viewerState.changePageRelative()` などのビジネスロジックを実行します 。

- **`StageViewMain`（複製ウィンドウ）**:
  画面複製専用の完全なパッシブ（受動）モードとするため、キーボードイベントのリレー（`onkeydown`）は一切登録せず無視します。

---

## 🔍 仕様変更に伴うメリットと、唯一の検討事項

### 💡 今回の仕様によるメリット

1. **泥臭い計算の完全排除**:
   コンポーネント外部（`ViewerMain` や `ViewerState`）で、DOMの高さやマジックナンバー（`- 100` など）を使ったスクロール位置からのページ逆算ロジック を自前で実装する必要が完全に無くなりました。

2. **薄いビューアの実現**:

`ViewerCore` を廃止した後の `ViewerMain` は、`SlideCanvas` が提供する標準的な双方向バインド（`scale`, `scrollTop`, `currentPageIndex`）を `viewerState` の各プロパティに直結するだけの、非常にクリーンで宣言的なコードになります 。

### ⚠️ 移行時における唯一の検討事項：ページ更新の循環発火（競合）ガード

現在、`ViewerState` には外部からページを強制変更するための `navigationSignal` や、`goToPage()` メソッドが存在します 。

- **検討ポイント**:
  ユーザーがツールバーやキー操作でページを「強制移動」させたとき（`ViewerState` ➔ `SlideCanvas` への通知）と、ユーザーがマウスでスクロールしてページが「自然移動」したとき（`SlideCanvas` ➔ `ViewerState` への逆バインド通知）が、同じ `currentPageIndex` の経路を通ることになります。
- **対策の方針**:
  `SlideCanvas` 内部のページ逆算・更新ロジックにおいて、「新しく計算されたインデックスが、現在の `currentPageIndex` と異なる場合のみ外部へ通知する（実差分ガード）」が厳密に行われているか（あるいは `ViewerState` 側のセッターで同値なら弾くガードが入っているか）を確認しておくと、チャタリングや無限ループを未然に防ぐことができ、より堅牢なシステムになります。

---

`currentPageIndex` の双方向同期前提により、設計の美しさとカプセル化が一段と洗練されましたね。この状態遷移の循環ガード（競合防止）の観点を含め、仕様の認識にズレや追加したい調整項目はございませんか？

確定した方針に基づき、`ViewerCore.svelte` を完全に廃止し、`SlideCanvas` を直接組み込むためのリファクタリング手順（移行手順）の草案と、実装前に確実に潰しておくべき技術的な検討事項をまとめました。

---

## 1. 移行手順（ステップ・バイ・ステップ）

移行作業は、影響範囲の狭い状態層（State）から始め、ビュー層（Main / StageView）へと段階的に展開します。

### フェーズ1：状態層（`ViewerState.svelte.ts`）のアップデート

1. **リアクティブなパースデータの定義**:

`ViewerState` クラス内に `$derived`（または `$derived.by`）を使用し、`appState.slidesHtml` から `ParsedSlideData` 型のオブジェクトを自動生成する読み取り専用のプロパティ（例：`slideData`）を追加します 。

2. **0始まりインデックスの仲介プロパティ（ゲッター/セッター）の実装**:

`bind:` 接続用として、内部の `currentPage`（1始まり） と相互変換を行う `currentPageIndex`（0始まり）のゲッターおよびセッターを定義します。

3. **同期用ペイロード（`stageSyncData`）の修正**:
   `stageSyncData` 派生オブジェクトの定義を書き換え、生の `slidesHtml` ではなく、上記で生成したパース済みの `SlideData` オブジェクトを内包させる仕様に変更します。
4. **旧レイアウト計算の廃止**:
   `SlideCanvas` 側にリサイズ・倍率計算を委ねるため、役割の終わる `updateLayout()` メソッドを削除（または非推奨化）します。

### フェーズ2：メイン画面（`ViewerMain.svelte`）の統合

1. **`ViewerCore` の排除**:

`ViewerCore` のインポートおよびコンポーネント呼び出し記述を完全に削除します 。

2. **`SlideCanvas` の直接配置**:

`#if viewerState.currentMode === "SCROLL"` などの分岐の内側に `SlideCanvas` を直接配置し 、各Propsを以下のように双方向バインドします。

- `bind:currentPageIndex={viewerState.currentPageIndex}`
- `bind:scale={viewerState.currentZoom}`
- `bind:scrollTop={viewerState.modeContexts.SCROLL.scrollTop}`

3. **表示モードと `fit_mode` の連動**:
   `viewerState.zoomMode` の値（`FIT_WIDTH`, `FIT_HEIGHT`, `ORIGINAL` / `CUSTOM`）に応じて、`SlideCanvas` の `fit_mode` にそれぞれ `"width"`, `"contain"`, `"none"` が渡るようにリアクティブにマッピングします。
4. **キーボードイベントの一元化**:

`ViewerMain` の `onMount` ライフサイクルで `window` に対する `keydown` リスナーを登録し、さらに `SlideCanvas` の `onkeydown` コールバックにも同一のイベントハンドラーを接続します 。このハンドラー内でページ操作や `appState.requestPrint()` を制御します 。

### フェーズ3：複製画面（`StageViewMain.svelte`）の統合

1. **`ViewerCore` の排除**:
   メイン画面同様、`ViewerCore` の依存記述をすべて削除します 。

2. **`SlideCanvas` の配置（パッシブモード）**:
   `StageViewMain` に `SlideCanvas` を直接配置します。ここではキーボードイベント（`onkeydown`）は一切設定せず空にします。
3. **受信ペイロードのバインド**:

`handleMessage` 内で、親ウィンドウから送られてきたパース済みの `SlideData` を直接受け取り 、ローカル状態を介して `SlideCanvas` の `data` Props へそのまま流し込みます。

### フェーズ4：既存コードの削除とクリーンアップ

1. **不要ファイルの物理削除**:
   完全に参照されなくなった `ViewerCore.svelte` をプロジェクトから削除します。

---

## 2. 詳細な検討事項（技術的エッジケースと対策）

リリプレイスを安全に行うため、以下の3点について既存コードと `SlideCanvas` の内部実装の仕様を突き合わせて確認しておく必要があります。

### 検討事項①：スクロール表示モードにおける「ページ強制移動」時のスクロール連動

- **背景と懸念点**:
  ツールバーのページ直接入力や、PresenterConsole側からの操作によって `viewerState.currentPageIndex` が外部から強制的に書き換わった場合、表示モードが `SCROLL` のときは、**該当するページ（`#slide-X`）の位置まで画面が自動でスクロールする挙動**が必要です。
  しかし、提示された `SlideCanvas.svelte` の最新ソース（57〜64行目）を見ると、`mode === 'scroll'` の時は全ページを結合したHTMLを一度に流し込んでおり、`currentPageIndex` の変化をトリガーにして `wrapperRef.scrollTo` を自発的に呼び出すロジックが見当たりません 。

- **対策**:
  `SlideCanvas` 側の内部実装に「`mode === 'scroll'` かつ外部から `currentPageIndex` が変更された場合、該当要素の `offsetTop * scale` を計算して `wrapperRef.scrollTo` を実行する」という `$effect` またはロジックが含まれているかを確認してください。もし含まれていない場合は、`SlideCanvas` 側の不備（要改修対象）として調整する必要があります。

### 検討事項②：状態の循環発火（無限ループ）を防止するセッターのガード

- **背景と懸念点**:
  ユーザーがスクロールした際、`SlideCanvas` が位置からページを逆算して `currentPageIndex` を外へ通知（逆バインド）します 。これにより `ViewerState` のセッターが起動しますが、そのセッターが再び内部状態を揺らした際、リアクティブの連鎖によって `SlideCanvas` 側に再度通知が行くという「循環発火」のリスクが懸念されます。

- **対策**:
  `ViewerState` に実装する `currentPageIndex` のセッター内部、あるいは `SlideCanvas` の内部双方で、「変更前と変更後の値が同一（`newValue === oldValue`）であれば、以降の処理や状態更新を即座にスキップする」という厳密な値差分ガード（競合防止）が徹底されているかを確認します。

### 検討事項③：ズームモード切り替え時（自動 ⇄ 手動）のスケール値の引き継ぎ

- **背景と懸念点**:
  ツールバーで「幅合わせ（`FIT_WIDTH`）」を選択している状態（`SlideCanvas` が自動で倍率を計算している状態）から、ユーザーが「拡大ボタン（`+`）」を押した瞬間、`ViewerState` 側は `zoomMode = "CUSTOM"` に切り替わり、倍率の主導権が外部（手動）に移ります 。

- **対策**:

`SlideCanvas` の実装では、`fit_mode !== 'none'` の間、自動計算された値が絶えず `scale` プロパティ（＝バインドされている `viewerState.currentZoom`）へと逆同期され続けています 。そのため、モードが `CUSTOM`（`fit_mode="none"`）に切り替わった瞬間も、直前までの自動計算値がそのままベースの数値として `viewerState.currentZoom` に残るため、破綻なくスムーズに手動ズーム（`+0.1` などの加算）へ移行できる仕様になっていると考えられます 。切り替え時のチラつきがないか、結合テスト時に注視すべきポイントです。

---

この手順草案と検討事項（特に検討事項①のスクロール連動に関する `SlideCanvas` 側の挙動確認）をベースに移行を進めることで、手戻りのない安全なリファクタリングが可能になります。この移行計画について、進め方に違和感や追加で確認したい挙動などはありますか？
