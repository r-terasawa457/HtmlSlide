// scrollController.ts
import { onDestroy } from "svelte";

export function createScrollController(
  onScroll: ((deltaX: number, deltaY: number) => void) | undefined = undefined,
) {
  // Reactive state using Svelte 5 runes
  let isScrolling = $state(false);
  let scrollTimeoutId: number | null = null;

  let touchStartY = 0;
  let touchStartX = 0;

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

  // Ensure timeout is cleaned up if the whole controller is destroyed
  onDestroy(() => {
    if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
  });

  // This is the functional action handler passed to {@attach}
  function attach(target: HTMLElement | undefined) {
    if (!onScroll || !target) return () => {};

    target.addEventListener("wheel", handleWheel, { passive: true });
    target.addEventListener("touchstart", handleTouchStart, { passive: true });
    target.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      if (!target) return;
      target.removeEventListener("wheel", handleWheel);
      target.removeEventListener("touchstart", handleTouchStart);
      target.removeEventListener("touchmove", handleTouchMove);
    };
  }

  // Expose the attach function and any reactive state you might need outside
  return {
    attach,
    get isScrolling() {
      return isScrolling;
    },
  };
}
