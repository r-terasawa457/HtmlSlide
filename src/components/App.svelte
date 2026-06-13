<script lang="ts">
  import "../css/viewer.css";
  import DropZone from "./DropZone.svelte";
  import ControlBar from "./Viewer/ControlBar.svelte";
  import ViewerCore from "./Viewer/ViewerCore.svelte";
  import { viewerState } from "../scripts/ViewerState.svelte";

  let isLoaded = $state(false);
  let refPrint = $state<{ print: () => void }>({ print: () => {} });

  function handleLoad() {
    isLoaded = true;
  }

  // タイトルのリアクティブ変更
  $effect(() => {
    if (viewerState.title) {
      document.title = viewerState.title;
    }
  });
</script>

{#if !isLoaded}
  <DropZone onLoad={handleLoad} />
{:else}
  <div id="viewer-ui">
    <ControlBar onPrint={() => refPrint.print()} />
    <ViewerCore bind:refPrint />
  </div>
{/if}
