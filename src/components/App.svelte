<script lang="ts">
  /**
   * @component App
   * @description アプリケーションのエントリーポイント。
   */
  import "../app.css"; // Tailwind v4 のエントリーポイントに変更
  import DropZone from "./DropZone.svelte";
  import ViewerMain from "./ViewerMain.svelte";
  import PrintManager from "./Print/PrintManager.svelte";
  import { initAppState } from "../states/AppState.svelte";
  import { initViewerState } from "../states/ViewerState.svelte";

  const appState = initAppState();
  initViewerState();

  $effect(() => {
    if (appState.title) {
      document.title = appState.title;
    }
  });
</script>

<div id="viewer-ui" class="absolute top-0 left-0 w-full h-full flex flex-col bg-[#525659] text-white font-sans overflow-hidden select-none">
  {#if !appState.isLoaded}
    <DropZone />
  {:else}
    <ViewerMain />

    {#if appState.isPrintRequested}
      <PrintManager />
    {/if}
  {/if}
</div>