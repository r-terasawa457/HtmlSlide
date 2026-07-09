<script lang="ts">
  import type { ParsedSlideData } from "./types";

  let {
    data,
    isScrolling = false,
    pages = "__all__",
  }: {
    data: ParsedSlideData;
    isScrolling?: boolean;
    pages?: Array<number> | "__all__";
  } = $props();
</script>

<div {...data.containerAttrs} class:prevent-pointer-events={isScrolling}>
  {#each data.commons as el}
    {@html el}
  {/each}
  {#each data.pages as el, i}
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
