<script lang="ts">
  import type { ParsedSlideData } from './types'
  let { data, mode, currentPageIndex, onMeasured } = $props<{
    data: ParsedSlideData;
    mode: 'scroll' | 'fit';
    currentPageIndex: number;
    onMeasured: (size: { width: number; height: number }) => void;
  }>();

  let container = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!container) return;

    // 1. 前の方針通りにHTMLを注入
    const commonsHtml = data.commons.join('\n');
    if (mode === 'scroll') {
      container.innerHTML = `${commonsHtml}\n${data.pages.join('\n')}`;
    } else {
      container.innerHTML = `${commonsHtml}\n${data.pages[currentPageIndex] ?? ''}`;
    }

    // 2. 注入直後、最初の .page 要素を探して実際のサイズを計測
    // fit-content なので、本来指定されている絶対サイズが取れる
    const firstPage = container.querySelector('section.page') as HTMLElement | null;
    if (firstPage) {
      onMeasured({
        width: firstPage.offsetWidth,
        height: firstPage.offsetHeight
      });
    }
  });
</script>

<div {...data.containerAttrs} bind:this={container}></div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    width: fit-content;
    height: fit-content;
    overflow: hidden; /* 計測中の余計なスクロールバーを防ぐ */
  }
</style>