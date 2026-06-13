<script lang="ts">
  /**
   * @component App
   * @description アプリケーションのエントリーポイント。
   * アプリケーション全体のグローバル状態（AppState, ViewerState）を初期化し、ファイルの読み込み状態（DropZone）やメインビューア（ViewerMain）、印刷管理（PrintManager）の出し分けを統括します。
   */
  import "../css/viewer.css";
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

{#if !appState.isLoaded}
  <DropZone />
{:else}
  <ViewerMain />

  {#if appState.isPrintRequested}
    <PrintManager />
  {/if}
{/if}