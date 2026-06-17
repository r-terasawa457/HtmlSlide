<script lang="ts">
  import { onMount } from 'svelte';
  import SlideCanvasInner from './SlideCanvasInner.svelte'; // 内側コンポーネント

  // 1. Props で外部からサイズと状態を受け取る (Svelte 5 Runes)
  let {
    data,
    mode = 'fit',
    currentPageIndex = 0,
    width = '100%',         // デフォルト値
    height = '100%'        // デフォルト値
  } = $props<{
    data: any; // パース済みスライドデータ
    mode?: 'scroll' | 'fit';
    currentPageIndex?: number;
    width?: string;         // "%", "px", "fit-content" など何でも可
    height?: string;
  }>();

  // ラッパー要素の実際のピクセルサイズをバインド
  let containerWidth = $state(0);
  let containerHeight = $state(0);

  // Innerから通知されるスライド本来の解像度
  let slideWidth = $state(1920);
  let slideHeight = $state(1080);
  let hasMeasured = $state(false);

  // SlideCanvas.svelte 内のスケール計算ロジック（安全なフォールバック付き）
  let scale = $derived.by(() => {
    if (!hasMeasured || containerWidth === 0 || containerHeight === 0) return 1;
    if (slideWidth === 0 || slideHeight === 0) return 1; // 異常系E-4対策

    const scaleX = containerWidth / slideWidth;
    if (height === 'fit-content') return scaleX;

    const scaleY = containerHeight / slideHeight;
    const computedScale = mode === 'fit' ? Math.min(scaleX, scaleY) : scaleX;

    // 万が一、計算結果が不正値になった場合のセーフティネット
    return isNaN(computedScale) || !isFinite(computedScale) ? 1 : computedScale;
  });

  // スケール後の実際の表示サイズ（fit-content 用のレイアウト補正）
  let renderedHeight = $derived(slideHeight * scale);

  // Inner（iframe内部）からのサイズ計測通知を受ける
  function handleMeasured(size: { width: number; height: number }) {
    slideWidth = size.width;
    slideHeight = size.height;
    hasMeasured = true;
  }
</script>

<div
  class="canvas-wrapper"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  style:width={width}
  style:height={height === 'fit-content' ? `${renderedHeight}px` : height}
>
  <iframe
    class="slide-canvas"
    style="
      width: {slideWidth}px;
      height: {slideHeight}px;
      transform: scale({scale});
      transform-origin: top left;
      opacity: {hasMeasured ? 1 : 0};
    "
    srcdoc="~"
  >
    </iframe>
</div>

<style>
  .canvas-wrapper {
    position: relative;
    overflow: hidden; /* スケールではみ出た部分をシャットアウト */
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .slide-canvas {
    border: none;
    flex-shrink: 0;
    position: absolute;
    top: 0;
    left: 0;
    transition: opacity 0.15s ease;
  }
</style>