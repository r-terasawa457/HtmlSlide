import MarkdownIt from "markdown-it";
import StateBlock from "markdown-it/lib/rules_block/state_block.mjs";

export interface colonBlockOptions {
  marker?: string;
  mode?: "indent" | "colon" | "hybrid";
}

export default function colonBlockPlugin(
  md: MarkdownIt,
  options: colonBlockOptions = {},
) {
  const markerChar = options.marker || ":";
  const mode = options.mode || "colon";
  const minLength = 3;

  function getMarkerCount(state: StateBlock, line: number): number {
    //TODO : 存在意義不明
    const bMark = state.bMarks[line] ?? 0;
    const tShift = state.tShift[line] ?? 0;
    const eMark = state.eMarks[line] ?? 0;
    const pos = bMark + tShift;
    let count = 0;
    while (pos + count < eMark && state.src[pos + count] === markerChar) {
      count++;
    }
    return count >= minLength ? count : 0;
  }

  function colonBlockRule(
    state: StateBlock,
    startLine: number,
    endLine: number,
    silent: boolean,
  ): boolean {
    const bMark = state.bMarks[startLine] ?? 0;
    const tShift = state.tShift[startLine] ?? 0;
    const eMark = state.eMarks[startLine] ?? 0;
    const pos = bMark + tShift;
    const lineText = state.src.slice(pos, eMark);

    // ==========================================
    // 1. 【1行ブロック記法】の処理
    // ==========================================
    if (
      lineText.startsWith(markerChar.repeat(2)) &&
      !lineText.startsWith(markerChar.repeat(3))
    ) {
      let inQuotes = false;
      let trueCloseIdx = -1;
      for (let i = 2; i < lineText.length; i++) {
        const char = lineText[i];
        if (char === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (
          !inQuotes &&
          char === markerChar &&
          lineText[i + 1] === markerChar &&
          lineText[i + 2] !== markerChar
        ) {
          trueCloseIdx = i;
          break;
        }
      }
      if (trueCloseIdx !== -1) {
        if (silent) return true;
        let tagNameEndIdx = 2;
        let tagName = "div";
        if (lineText.length > 2 && lineText[2] !== " ") {
          tagNameEndIdx = lineText.slice(0, trueCloseIdx).indexOf(" ");
          if (tagNameEndIdx === -1) {
            tagNameEndIdx = trueCloseIdx;
          }
          tagName = lineText.slice(2, tagNameEndIdx);
        }
        //TODO : 属性のパースをもっとちゃんとやる（クォート内スペースとかも考慮する）
        const attrPart = lineText.slice(tagNameEndIdx, trueCloseIdx).trim();
        const inlineContent = lineText.slice(trueCloseIdx + 2).trim();

        const tokenOpen = state.push("colon_block_open", tagName, 1);
        tokenOpen.markup = markerChar.repeat(2);
        tokenOpen.map = [startLine, startLine + 1];
        if (attrPart) tokenOpen.attrSet("data-attr", attrPart);

        const tokenInline = state.push("inline", "", 0);
        tokenInline.content = inlineContent;
        tokenInline.map = [startLine, startLine + 1];
        tokenInline.children = [];

        const tokenClose = state.push("colon_block_close", tagName, -1);
        tokenClose.markup = markerChar.repeat(2);

        state.line = startLine + 1;
        return true;
      }
    }

    // ==========================================
    // 2. 【複数行ブロック記法】のバリデーション
    // ==========================================
    const startMarkerCount = getMarkerCount(state, startLine);
    if (startMarkerCount === 0) return false;
    if (silent) return true;

    const rawContent = state.src.slice(pos + startMarkerCount, eMark);
    let tagName = "div";
    let tagNameLength = 1;
    if (rawContent[0] !== " ") {
      console.log("rawContent:", rawContent);
      tagNameLength =
        rawContent.indexOf(" ") !== -1
          ? rawContent.indexOf(" ")
          : rawContent.length;
      tagName = rawContent.slice(0, tagNameLength);
    }
    const tokenOpen = state.push("colon_block_open", tagName, 1);
    tokenOpen.markup = markerChar.repeat(startMarkerCount);
    tokenOpen.map = [startLine, 0];
    if (rawContent)
      tokenOpen.attrSet("data-meta", rawContent.slice(tagNameLength).trim());

    // ==========================================
    // 3. 下方向への行スキャン（終了条件の判定）
    // ==========================================
    let nextLine = startLine + 1;
    let hasExplicitClose = false;

    // 子要素をパースする際の「期待されるインデント深さ」を設定
    const innerBlkIndent = mode === "indent" ? tShift + 4 : tShift;

    for (; nextLine < endLine; nextLine++) {
      if (state.isEmpty(nextLine)) continue;

      const currentTShift = state.tShift[nextLine] ?? 0;
      const currentSCount = state.sCount[nextLine] ?? 0;

      // 【モード1】indentモード：インデントが浅くなったら終了
      if (mode === "indent" && currentSCount < innerBlkIndent) {
        break;
      }

      // 【モード2 / 3】コロンの数による終了判定
      if (mode === "colon" || mode === "hybrid") {
        const currentMarkerCount = getMarkerCount(state, nextLine);
        if (currentMarkerCount > 0) {
          if (currentMarkerCount < startMarkerCount) break;
          if (currentMarkerCount === startMarkerCount) {
            hasExplicitClose = true;
            break;
          }
        }
        // hybridモードのインデント戻り判定
        if (mode === "hybrid" && currentSCount < innerBlkIndent) {
          break;
        }
      }
    }

    // ==========================================
    // 4. 内部要素の再帰パース（インデントの調整・隔離）
    // ==========================================
    // 親の環境状態をすべてバックアップ
    const oldBlkIndent = state.blkIndent;
    const oldLineMax = state.lineMax;
    const oldParentShift = state.tShift.slice();
    const oldSCount = state.sCount.slice();

    // 重要!!：内部パース時に、子要素行の「見た目のスペースインデント」を
    // ブロック開始ライン（親）と同じ基準にシフト・相殺させて markdown-it に認識させる
    if (mode === "indent") {
      for (let i = startLine + 1; i < nextLine; i++) {
        state.tShift[i] = Math.max(0, (state.tShift[i] ?? 0) - innerBlkIndent);
        state.sCount[i] = Math.max(0, (state.sCount[i] ?? 0) - innerBlkIndent);
      }
    }

    state.blkIndent = innerBlkIndent;
    state.lineMax = nextLine;

    // 安全に内部トークンを生成
    state.md.block.tokenize(state, startLine + 1, nextLine);

    // バックアップから元の環境状態に完全復元
    state.blkIndent = oldBlkIndent;
    state.lineMax = oldLineMax;
    for (let i = startLine + 1; i < nextLine; i++) {
      state.tShift[i] = oldParentShift[i] ?? 0;
      state.sCount[i] = oldSCount[i] ?? 0;
    }

    // ==========================================
    // 5. 終了タグの処理と、次行へのポインタ遷移
    // ==========================================
    const tokenClose = state.push("colon_block_close", tagName, -1);
    tokenClose.markup = markerChar.repeat(startMarkerCount);

    if (tokenOpen.map) {
      tokenOpen.map[1] = hasExplicitClose ? nextLine + 1 : nextLine;
    }

    state.line = hasExplicitClose ? nextLine + 1 : nextLine;
    return true;
  }

  md.block.ruler.before("paragraph", "colon_block", colonBlockRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}
