<script lang="ts">
  /**
   * @component LaserPointerOverlay
   * @description 親側でViewport相対にダイレクト計算された物理ピクセル（px）を受け取り、
   * スクロールに影響されない固定レイヤー上にレーザーポインターのドットを超低遅延で描画します。
   */

  // --- Props 定義 ---
  let {
    x,
    y
  } = $props<{
    x: number; // Viewport相対の物理ピクセルX座標
    y: number; // Viewport相対の物理ピクセルY座標
  }>();
</script>

{#if x !== -1 && y !== -1}
<div 
  class="laser-dot" 
  style:left="{x}px" 
  style:top="{y}px"
></div>
{/if}

<style>
  .laser-dot {
    position: absolute;
    width: 12px;
    height: 12px;
    background-color: #ff1744;
    border-radius: 50%;
    /* ドットの中心が正確に計算された座標に重なるように調整 */
    transform: translate(-50%, -50%);
    /* 発光エフェクト */
    box-shadow: 0 0 24px #ff1744, 0 0 48px #ff1744;
    /* ブラウザのレイアウト再計算(Reflow)をバイパスし、GPUで高速描画するための最適化 */
    will-change: left, top;
    /* マウス操作やクリックを一切妨害しない */
    pointer-events: none;
    /* 隔離iframeや他のコンテンツより前面に描画するためのレイヤー順序 */
    z-index: 100; 
  }
</style>