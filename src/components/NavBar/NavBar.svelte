<script lang="ts">
  import { getContext } from 'svelte';
  import { NAVIGATION_KEY, type NavigationRegistry } from './navigation.svelte';

  const nav = getContext<NavigationRegistry>(NAVIGATION_KEY);
</script>

<nav class="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
  
  <div class="flex shrink-0 items-center gap-4">
    <span class="text-sm font-semibold tracking-wider text-gray-900 dark:text-white">DesktopApp</span>
    </div>

  <div class="mx-4 flex flex-1 items-center justify-center">
    {#if nav.centerContent}
      {@render nav.centerContent()}
    {/if}
  </div>

  <div class="flex shrink-0 items-center gap-2 justify-end min-w-30">
    {#each nav.rightActions as action (action.id)}
      <button
        onclick={action.action}
        disabled={action.disabled}
        class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50
          {action.variant === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-500 disabled:hover:bg-blue-600' : ''}
          {action.variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-500 disabled:hover:bg-red-600' : ''}
          {action.variant === 'secondary' || !action.variant ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700' : ''}"
      >
        {action.label}
      </button>
    {/each}
  </div>

</nav>