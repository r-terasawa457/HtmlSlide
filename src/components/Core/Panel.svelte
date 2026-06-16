<script lang="ts">
  import type { PanelState } from "./panelManager.svelte";

  interface Props {
    panel: PanelState;
  }

  let { panel }: Props = $props();
  // svelte-ignore non_reactive_update
  let componentInstance = null;

  const TargetComponent = $derived(panel.component);
</script>

{#if panel.isOpen}
  <div 
    class="flex flex-col border-r border-gray-200 dark:border-gray-800" 
    style="width: {panel.width}px;"
  >
    <div class="flex h-10 items-center px-4 border-b border-gray-100 dark:border-gray-800">
      <span class="text-xs font-bold text-gray-400">{panel.title}</span>
    </div>

    <div class="flex-1 overflow-auto">
      <TargetComponent 
        bind:this={componentInstance} 
        {...panel.props} 
      />
    </div>
  </div>
{/if}