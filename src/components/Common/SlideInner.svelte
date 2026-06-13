<script lang="ts">
  /**
   * iframe内部のDOM構造やスタイルを完全に維持したまま、
   * 各スライドページの表示・非表示のみを制御するコンポーネント
   */
  interface Props {
    config: {
      slidesHtml: string;
      isPresentMode: boolean;
      currentPageIndex: number;
      hiddenPageIndices: Set<number>;
      viewMode: "all" | "single";
    };
  }

  let { config }: Props = $props();
  let container = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!container) return;

    if (container.innerHTML !== config.slidesHtml) {
      container.innerHTML = config.slidesHtml;
    }

    const pages = container.querySelectorAll(".page");
    pages.forEach((page: Element) => {
      const element = page as HTMLElement;
      const pageAttr = element.getAttribute("data-page");
      if (!pageAttr) return;

      // 1始まりのページ番号文字列を0始まりのインデックスに変換
      const pageIndex = parseInt(pageAttr, 10) - 1;
      
      const isVisible = config.viewMode === "all"
        ? !config.hiddenPageIndices.has(pageIndex)
        : pageIndex === config.currentPageIndex;

      if (isVisible) {
        element.style.removeProperty("display");
      } else {
        element.style.setProperty("display", "none", "important");
      }
    });
  });
</script>

<div id="slide-root" bind:this={container}></div>