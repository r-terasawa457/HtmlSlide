import MarkdownIt from "markdown-it";
import customBlockPlugin from "./ColonBlockPlugin";

// 1. markdown-it インスタンスを作成し、プラグインを適用（まずはデフォルトの indent モード）
const md = new MarkdownIt({ html: true });
md.use(customBlockPlugin, { mode: "indent" });

// 2. テスト用Markdown文字列の定義
const testMarkdown = `
# テスト開始

1行ブロックのテスト（属性内にコロンやクォートを含む）：
::note class="box" style="color: #222222;":: ここはインライン本文です。**太字**もOK。
::note2:: ここは別のインライン本文。クォートとコロンを属性に含むテスト。

複数行ブロックのテスト（インデント戻り検知）：
:::: flex id="main-flex"
    :::flex col-7
    ## 左カラム
    ここは左の中身です。
    
    空行があっても閉じないかテスト。
    ::: col-5
    ## 右カラム
    ここは右の中身。

インデントが左に戻ったので、上の flex はここで自動的に閉じているはずです。
`;

console.log("=== [mode: indent] のレンダリング結果 ===");
const result = md.render(testMarkdown);
console.log(result);

// 3. モードを 'colon'（インデント任意・コロン数一致で閉じる）に変えた場合のテスト
const mdColon = new MarkdownIt({ html: true });
mdColon.use(customBlockPlugin, { mode: "colon" });

const testMarkdownColon = `
# コロンモードテスト

::::: main-wrapper
:::: flex
:::flex col-12
左寄せだけどコロンの数で親子を判定するテスト。
:::
::::
:::::
`;

console.log("=== [mode: colon] のレンダリング結果 ===");
console.log(mdColon.render(testMarkdownColon));
