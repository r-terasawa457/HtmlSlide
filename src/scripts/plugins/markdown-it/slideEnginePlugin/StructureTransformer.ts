import Token from "markdown-it/lib/token.mjs";
import StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import { type SlideEnv, isHeaderToken, isFooterToken } from "./MetaParser";

/**
 * ページ内のトップレベル要素を分類するためのブロックラッパー。
 */
interface TopLevelBlock {
  /** ブロックのセマンティクス種別 */
  type: "header" | "footer" | "content";
  /** ブロックを構成するトークン配列 */
  tokens: Token[];
}

/**
 * フラットなMarkdownトークンストリームを解析し、スライドごとの独立した構造へ再構築するトランスフォーマー。
 * 各ページ内のトップレベルに配置された固有のヘッダーやフッターを動的に検出し、
 * 描画コンテキスト（globalHeader/Footer）と差し替えて所定のレイアウト位置へ非破壊的にインジェクションします。
 */
export class StructureTransformer {
  private static readonly HEADER_REGEX = /^<header\b/i;
  private static readonly FOOTER_REGEX = /^<footer\b/i;

  /**
   * メインのトークン配列をスライド単位に変形し、適切なレイアウトパーツをマッピングした上で
   * 再びフラットなトークンストリームに再結合してstateを更新します。
   * * @param state - markdown-it のコア実行状態
   * @param env - スライドの環境変数コンテキスト
   */
  public static transform(state: StateCore, env: SlideEnv): void {
    const pages = this.splitPages(state.tokens);
    env.slideCount = pages.length;

    const transformedTokens: Token[] = [];
    pages.forEach((pageTokens, index) => {
      transformedTokens.push(
        ...this.buildSlidePage(pageTokens, index, state, env),
      );
    });

    state.tokens = transformedTokens;
  }

  /**
   * hrトークンを区切り文字として、トークンストリームをページごとの二次元配列に分割します。
   * * @param tokens - コンテンツセクションの全トークン
   * @returns ページごとにグループ化されたトークン配列の配列
   */
  private static splitPages(tokens: Token[]): Token[][] {
    const pages: Token[][] = [];
    let currentPage: Token[] = [];

    for (const token of tokens) {
      if (token.type === "hr") {
        if (currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
        }
        continue;
      }
      currentPage.push(token);
    }

    if (currentPage.length > 0) {
      pages.push(currentPage);
    }

    return pages;
  }

  /**
   * 単一ページのスライドトークン群からトップレベルの固有ヘッダー・フッターを分離し、
   * セクションラッパー、コンテンツコンテナ、および抽出されたパーツを組み合わせて正しいスライド構造を構築します。
   * * @param pageTokens - 該当ページに属するトークン配列
   * @param index - 0始まりのページインデックス
   * @param state - markdown-it のコア実行状態
   * @param env - スライドの環境変数コンテキスト
   * @returns 構造化が完了した該当ページのトークン配列
   */
  private static buildSlidePage(
    pageTokens: Token[],
    index: number,
    state: StateCore,
    env: SlideEnv,
  ): Token[] {
    const slidePage: Token[] = [];
    const pageNumber = index + 1;

    // ページ固有の <style> トークンを走査して抽出する
    const styleTokens: Token[] = [];
    const STYLE_REGEX = /^<style\b/i;
    const remainingTokens: Token[] = [];

    for (const token of pageTokens) {
      if (
        token.type === "html_block" &&
        STYLE_REGEX.test(token.content.trim())
      ) {
        styleTokens.push(token);
      } else {
        remainingTokens.push(token);
      }
    }

    const topLevelBlocks = this.groupTopLevelBlocks(remainingTokens);
    const { firstHeaderIdx, lastFooterIdx } =
      this.findTargetLayoutIndices(topLevelBlocks);

    const sectionOpen = new state.Token("section_open", "section", 1);
    sectionOpen.block = true;
    sectionOpen.attrs = [
      ["class", "page"],
      ["id", `slide-${pageNumber}`],
      ["data-page", pageNumber.toString()],
    ];
    slidePage.push(sectionOpen);

    // 抽出した <style> を header や div.content よりも前のページの最先頭に配置
    slidePage.push(...styleTokens);

    if (firstHeaderIdx !== -1) {
      slidePage.push(...(topLevelBlocks[firstHeaderIdx]?.tokens ?? []));
    } else if (env.globalHeader) {
      slidePage.push(...this.cloneTokens(env.globalHeader, state));
    }

    const contentOpen = new state.Token("div_open", "div", 1);
    contentOpen.block = true;
    contentOpen.attrs = [["class", "content"]];
    slidePage.push(contentOpen);

    topLevelBlocks.forEach((block, idx) => {
      if (idx !== firstHeaderIdx && idx !== lastFooterIdx) {
        slidePage.push(...block.tokens);
      }
    });

    const contentClose = new state.Token("div_close", "div", -1);
    contentClose.block = true;
    slidePage.push(contentClose);

    if (lastFooterIdx !== -1) {
      slidePage.push(...(topLevelBlocks[lastFooterIdx]?.tokens ?? []));
    } else if (env.globalFooter) {
      slidePage.push(...this.cloneTokens(env.globalFooter, state));
    }

    const sectionClose = new state.Token("section_close", "section", -1);
    sectionClose.block = true;
    slidePage.push(sectionClose);

    return slidePage;
  }

  /**
   * トークンの nesting の累積（深度）を管理し、インラインや子ブロックに内包されていない
   * 完全なトップレベルのブロック単位にグループ化します。
   * * @param tokens - ページのフラットなトークン配列
   * @returns 種別ごとに分類されたトップレベルブロックの配列
   */
  private static groupTopLevelBlocks(tokens: Token[]): TopLevelBlock[] {
    const blocks: TopLevelBlock[] = [];
    let currentTokens: Token[] = [];
    let currentType: "header" | "footer" | "content" = "content";
    let depth = 0;

    for (const token of tokens) {
      if (depth === 0) {
        if (isHeaderToken(token)) {
          currentType = "header";
        } else if (isFooterToken(token)) {
          currentType = "footer";
        } else {
          currentType = "content";
        }
      }

      currentTokens.push(token);
      depth += token.nesting;

      if (depth === 0) {
        blocks.push({ type: currentType, tokens: currentTokens });
        currentTokens = [];
      }
    }

    if (currentTokens.length > 0) {
      blocks.push({ type: currentType, tokens: currentTokens });
    }

    return blocks;
  }

  /**
   * グループ化されたトップレベルブロック群から、最初に見つかったヘッダーのインデックスと、
   * 最後に見つかったフッターのインデックスを走査・特定します。
   * * @param blocks - トップレベルブロックの配列
   * @returns 特定されたヘッダーとフッターのインデックスオブジェクト
   */
  private static findTargetLayoutIndices(blocks: TopLevelBlock[]): {
    firstHeaderIdx: number;
    lastFooterIdx: number;
  } {
    let firstHeaderIdx = -1;
    let lastFooterIdx = -1;

    for (const [i, block] of blocks.entries()) {
      if (block.type === "header" && firstHeaderIdx === -1) {
        firstHeaderIdx = i;
      }
      if (block.type === "footer") {
        lastFooterIdx = i;
      }
    }

    return { firstHeaderIdx, lastFooterIdx };
  }

  /**
   * markdown-itのトークンインスタンスを副作用なく安全に複数ページへマッピングするため、
   * プロトタイプおよびメタデータを維持しながら参照型プロパティをディープコピーします。
   * * @param tokens - コピー元のトークン配列
   * @param state - markdown-it のコア実行状態
   * @returns コピーされた新しいトークン配列
   */
  private static cloneTokens(tokens: Token[], state: StateCore): Token[] {
    return tokens.map((token) => {
      const clone = Object.assign(
        new state.Token(token.type, token.tag, token.nesting),
        token,
      );

      if (token.attrs) {
        clone.attrs = token.attrs.map((attr) => [...attr] as [string, string]);
      }

      if (token.children) {
        clone.children = this.cloneTokens(token.children, state);
      }

      return clone;
    });
  }
}
