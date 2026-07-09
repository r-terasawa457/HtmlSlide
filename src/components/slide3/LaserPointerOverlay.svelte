<script lang="ts">
  /**
   * @component LaserPointerOverlay
   * @description スライドに重ねた領域上でレーザーポインターのドットを描画する専用コンポーネント。
   */

  let {
    width = 0,
    height = 0,
    x = -1,
    y = -1,
    top = 0,
    left = 0,
    isMouseTracking = false,
    onPointerMove,
    onWheelDelta = undefined,
  } = $props<{
    width: number;
    height: number;
    x: number;
    y: number;
    top?: number;
    left?: number;
    isMouseTracking?: boolean;
    onPointerMove?: (x: number, y: number) => void;
  }>();

  function trackPointer(node: HTMLElement) {
    if (!isMouseTracking || !onPointerMove) return;

    const handleGlobalMove = (e: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const relativeY = e.clientY - rect.top;

      if (
        relativeX >= 0 &&
        relativeX <= width &&
        relativeY >= 0 &&
        relativeY <= height
      ) {
        onPointerMove(relativeX, relativeY);
      } else if (x !== -1 || y !== -1) {
        onPointerMove(-1, -1);
      }
    };
    document.addEventListener("pointermove", handleGlobalMove);

    return () => {
      document.removeEventListener("pointermove", handleGlobalMove);
    };
  }
</script>

<div
  {@attach trackPointer}
  class="laser-pointer-overlay"
  style:width="{width}px"
  style:height="{height}px"
  style:top="{top}px"
  style:left="{left}px"
  class:prevent-pointer-events={!isMouseTracking}
  class:hide-cursor={isMouseTracking}
>
  <div
    class="laser-dot"
    style:transform="translate({x}px, {y}px)"
    class:zero-opacity={x === -1 || y === -1}
  ></div>
</div>

<style>
  .zero-opacity {
    opacity: 0;
  }
  .laser-pointer-overlay {
    position: absolute;
    z-index: 90;
    background: transparent;
  }
  .prevent-pointer-events {
    pointer-events: none;
  }
  .hide-cursor {
    cursor: none !important;
  }
  .laser-dot {
    position: absolute;
    top: -6px;
    left: -6px;
    width: 12px;
    height: 12px;
    background-color: #ff1744;
    border-radius: 50%;
    box-shadow:
      0 0 24px #ff1744,
      0 0 48px #ff1744;
    transform-origin: center;
  }
</style>
