<script lang="ts">
  import {
    type SlideData,
    type SlideMeta,
    type PageSize,
    getSlideDataStore,
  } from "./SlideStore.svelte";

  let {
    isScrolling = false,
    pages = "__all__",
  }: {
    isScrolling?: boolean;
    pages?: Array<number> | "__all__";
  } = $props();

  const slideDataStore = getSlideDataStore();
  const data = slideDataStore.slideData;
  const meta = slideDataStore.slideMeta;

  let containerRef = $state<HTMLDivElement | undefined>(undefined);
  $effect(() => {
    if (containerRef === undefined) {
      return;
    }

    const knownPageSizes = meta.pageSizes;
    const pages = containerRef.querySelectorAll("section.page");
    const pageSizes: Record<number, PageSize> = {};
    for (const page of pages) {
      const rect = page.getBoundingClientRect();
      const pageSize = { width: rect.width, height: rect.height };
      const pageIdx = Number(page.getAttribute("data-page")) - 1;
      if (
        knownPageSizes[pageIdx]?.width === pageSize.width &&
        knownPageSizes[pageIdx]?.height === pageSize.height
      )
        continue;

      pageSizes[pageIdx] = pageSize;
    }

    if (Object.keys(pageSizes).length !== 0) {
      slideDataStore.setPageSizes(pageSizes);
    }
  });
</script>

<div
  bind:this={containerRef}
  {...data.containerAttrs}
  class:prevent-pointer-events={isScrolling}
>
  {#each data.commonElements as el}
    {@html el}
  {/each}
  {#each data.pageElements as el, i}
    {#if pages === "__all__" || i in pages}
      {@html el}
    {/if}
  {/each}
</div>

<style>
  .prevent-pointer-events {
    pointer-events: none;
  }
</style>
