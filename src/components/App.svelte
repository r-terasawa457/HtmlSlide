<script lang="ts">
  import "../css/viewer.css";
  import DropZone from "./DropZone.svelte";
  import ControlBar from "./Viewer/ControlBar.svelte";
  import ViewerCore from "./Viewer/ViewerCore.svelte";
  import PrintManager from "./Print/PrintManager.svelte";
  import { initAppState } from "../states/AppState.svelte";
  import { initViewerState } from "../states/ViewerState.svelte";

  const appState = initAppState();
  const viewerState = initViewerState();

  $effect(() => {
    if (appState.title) {
      document.title = appState.title;
    }
  });

  $effect(() => {
    const page = viewerState.currentPage;
    if (appState.presenterWindow) {
      appState.presenterWindow.postMessage({ type: "sync_page", page }, "*");
    }
  });
</script>

{#if !appState.isLoaded}
  <DropZone />
{:else}
  <div id="viewer-ui">
    <ControlBar />
    <ViewerCore />
  </div>

  {#if appState.isPrintRequested}
    <PrintManager />
  {/if}
{/if}