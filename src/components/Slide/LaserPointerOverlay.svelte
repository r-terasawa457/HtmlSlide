<script lang="ts">
  /**
   * @component LaserPointerOverlay
   * @description SlideCanvas内の等倍エミュレート空間上に、レーザーポインターのドットを描画する専用コンポーネント。
   */

  let {
    active = false,
    x = 0,
    y = 0,
    isPresenter = false
  } = $props<{
    active: boolean;
    x?: number;
    y?: number;
    isPresenter?: boolean;
  }>();
</script>

{#if active && x >= 0 && x <= 1 && y >= 0 && y <= 1}
  <div class="laser-pointer-overlay">
    <div 
      class="laser-dot" 
      style:left="{x * 100}%" 
      style:top="{y * 100}%"
    ></div>
  </div>
{/if}

<style>
  .laser-pointer-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 90;
    pointer-events: none;
    background: transparent;
  }

  .laser-dot {
    position: absolute;
    width: 12px;
    height: 12px;
    background-color: #ff1744;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 24px #ff1744, 0 0 48px #ff1744;
    will-change: left, top;
  }
</style>