<script lang="ts">
  import type { ParsedSlideData } from "./types";

  let {
    data,
    isScrolling = false,
  }: { data: ParsedSlideData; isScrolling?: boolean } = $props();
</script>

<div {...data.containerAttrs} class:prevent-pointer-events={isScrolling}>
  {#each data.commons as el}
    {@html el}
  {/each}
  {#each data.pages as el}
    {@html el}
  {/each}
</div>

<style>
  .prevent-pointer-events {
    pointer-events: none;
  }
</style>
