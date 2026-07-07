<script lang="ts">
  import type { ParsedSlideData } from "./types";

  let { data }: { data: ParsedSlideData } = $props();
</script>

<div {...data.containerAttrs}>
  {#each data.commons as el}
    {@html el}
  {/each}
  {#each data.pages as el}
    {@html el}
  {/each}
</div>
