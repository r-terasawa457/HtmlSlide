import Token from "markdown-it/lib/token.mjs";
import StateCore from "markdown-it/lib/rules_core/state_core.mjs";
import { type SlideEnv } from "./MetaParser";

interface TopLevelBlock {
  type: "header" | "footer" | "content";
  tokens: Token[];
}

/**
 * フラットなMarkdownトークンストリームを解析し、スライドごとの独立した構造へ再構築するトランスフォーマー。
 * 各ページ内のトップレベルに配置された固有のヘッダー（最初）やフッター（最後）を動的に検出し、
 * 描画コンテキスト（globalHeader/Footer）と差し替えて所定のレイアウト位置へ非破壊的にインジェクションする。
 */
export class StructureTransformer {
  /**
   * メインのトークン配列をスライド単位に変形し、適切なレイアウトパーツをマッピングした上で
   * 再びフラットなトークンストリームに再結合してstateを更新する。
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
   * hrトークンを区切り文字として、トークンストリームをページごとの二次元配列に分割する。
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
   * セクションラッパー、コンテンツコンテナ、および抽出されたパーツを組み合わせて正しいスライド構造を構築する。
   */
  private static buildSlidePage(
    pageTokens: Token[],
    index: number,
    state: StateCore,
    env: SlideEnv,
  ): Token[] {
    const slidePage: Token[] = [];
    const pageNumber = index + 1;

    const topLevelBlocks = this.groupTopLevelBlocks(pageTokens);
    const { firstHeaderIdx, lastFooterIdx } =
      this.findTargetLayoutIndices(topLevelBlocks);

    const sectionOpen = new state.Token("section_open", "section", 1);
    sectionOpen.block = true;
    sectionOpen.attrs = [
      ["class", "slide"],
      ["id", `slide-${pageNumber}`],
      ["data-page", pageNumber.toString()],
    ];
    slidePage.push(sectionOpen);

    if (firstHeaderIdx !== -1) {
      slidePage.push(...(topLevelBlocks[firstHeaderIdx]?.tokens ?? []));
    } else if (env.globalHeader) {
      slidePage.push(...this.cloneTokens(env.globalHeader, state));
    }

    const contentOpen = new state.Token("div_open", "div", 1);
    contentOpen.block = true;
    contentOpen.attrs = [["class", "slide-content"]];
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
   * 完全なトップレベルのブロック単位（単一のhtml_block、またはコンテナのopenからcloseまで）にグループ化する。
   */
  private static groupTopLevelBlocks(tokens: Token[]): TopLevelBlock[] {
    const blocks: TopLevelBlock[] = [];
    let currentTokens: Token[] = [];
    let currentType: "header" | "footer" | "content" = "content";
    let depth = 0;

    for (const token of tokens) {
      if (depth === 0) {
        if (
          (token.type === "html_block" &&
            token.content.startsWith("<header>")) ||
          token.type === "container_header_open"
        ) {
          currentType = "header";
        } else if (
          (token.type === "html_block" &&
            token.content.startsWith("<footer")) ||
          token.type === "container_footer_open"
        ) {
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
   * 最後に見つかったフッターのインデックスを走査・特定する。
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
   * トークン配列とその子要素（children）を再帰的にディープコピーする。
   */
  private static cloneTokens(tokens: Token[], state: StateCore): Token[] {
    return tokens.map((token) => {
      const clone = new state.Token(token.type, token.tag, token.nesting);
      clone.content = token.content;
      clone.markup = token.markup;
      clone.info = token.info;
      clone.block = token.block;

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
