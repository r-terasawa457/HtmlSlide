/**
 * スクロールおよびタッチジェスチャーによるスクロール量を一元管理するコントローラー
 */
export function createScrollController(
  onScroll?: (deltaX: number, deltaY: number) => void,
) {
  let isScrolling = $state(false);
  let scrollTimeoutId: number | null = null;

  let touchStartX = 0;
  let touchStartY = 0;

  function activateScrollLock() {
    isScrolling = true;
    if (scrollTimeoutId) clearTimeout(scrollTimeoutId);

    scrollTimeoutId = window.setTimeout(() => {
      isScrolling = false;
      scrollTimeoutId = null;
    }, 150);
  }

  const handleWheel = (e: WheelEvent) => {
    activateScrollLock();
    onScroll?.(e.deltaX, e.deltaY);
  };

  const handleTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;

    const deltaX = touchStartX - touch.clientX;
    const deltaY = touchStartY - touch.clientY;

    activateScrollLock();
    onScroll?.(deltaX, deltaY);

    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  };

  /**
   * 対象の要素にイベントリスナーを紐付けます。
   * 返却されるクリーンアップ関数を実行することで安全に解除されます。
   */
  function attach(target: HTMLElement | Document | null | undefined) {
    if (!onScroll || !target) return () => {};

    const options = { passive: true };
    target.addEventListener("wheel", handleWheel as EventListener, options);
    target.addEventListener(
      "touchstart",
      handleTouchStart as EventListener,
      options,
    );
    target.addEventListener(
      "touchmove",
      handleTouchMove as EventListener,
      options,
    );

    return () => {
      target.removeEventListener("wheel", handleWheel as EventListener);
      target.removeEventListener(
        "touchstart",
        handleTouchStart as EventListener,
      );
      target.removeEventListener("touchmove", handleTouchMove as EventListener);

      if (scrollTimeoutId) {
        clearTimeout(scrollTimeoutId);
        scrollTimeoutId = null;
      }
    };
  }

  return {
    attach,
    get isScrolling() {
      return isScrolling;
    },
  };
}
