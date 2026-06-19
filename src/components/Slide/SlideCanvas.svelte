<script lang="ts">
  /**
   * @file SlideCanvas.svelte
   * @description ダミースクロール（ハイブリッド同期）方式を採用した高性能スライドレンダラー。
   * 親コンテナでのスクロール管理とiframe内部のネイティブスクロールを同期させ、
   * スタイル隔離、自由なスケーリング、および content-visibility による描画最適化を両立します。
   */

  import type { ParsedSlideData } from './types';

  let {
    data,
    mode = 'slide',
    fit_mode = 'contain',
    currentPageIndex = $bindable(0),
    scale = $bindable(1.0),
    width = '100%',
    height = '100%',
    scrollTop = $bindable(0),
    scrollLeft = $bindable(0),
    onscroll,
    onkeydown
  } = $props<{
    data: ParsedSlideData;
    mode?: 'scroll' | 'slide';
    fit_mode?: 'contain' | 'width' | 'none';
    currentPageIndex?: number;
    scale?: number;
    width?: string;
    height?: string;
    scrollTop?: number;
    scrollLeft?: number;
    onscroll?: (top: number, left: number) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }>();

  let wrapperRef = $state<HTMLDivElement | null>(null);
  let iframeRef = $state<HTMLIFrameElement | null>(null);

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let slideWidth = $state(1920);
  let slideHeight = $state(1080);
  let hasMeasured = $state(false);

  let lastPageIndex = $state<number | undefined>(undefined);
  let prevMode = $state<'slide' | 'scroll' | undefined>(undefined);

  let tickingWrapper = false;
  let tickingIframe = false;

  let totalInternalWidth = $derived(slideWidth);
  let totalInternalHeight = $derived(
    mode === 'scroll' ? slideHeight * data.pages.length : slideHeight
  );

  let computedScale = $derived.by(() => {
    if (fit_mode === 'none') return scale;
    if (!hasMeasured || containerWidth === 0 || containerHeight === 0) return 1.0;
    if (slideWidth === 0 || slideHeight === 0) return 1.0;

    const scaleX = containerWidth / slideWidth;
    if (fit_mode === 'width') return scaleX;

    const scaleY = containerHeight / slideHeight;
    return Math.min(scaleX, scaleY);
  });

  /**
   * 自動計算されたスケール倍率を外部バインドへ同期するライフサイクル。
   */
  $effect(() => {
    if (fit_mode !== 'none') {
      scale = computedScale;
    }
  });

  /**
   * スクロール位置（scrollTop）から currentPageIndex への同期。
   * ユーザー操作や外部からのスクロールにより表示ページが変わった際に、currentPageIndex を更新します。
   */
  $effect(() => {
    if (mode === 'scroll' && slideHeight > 0) {
      const internalScrollTop = scrollTop / (scale || 1.0);
      const computedIndex = Math.max(
        0,
        Math.min(data.pages.length - 1, Math.round(internalScrollTop / slideHeight))
      );
      if (currentPageIndex !== computedIndex) {
        currentPageIndex = computedIndex;
        lastPageIndex = computedIndex;
      }
    }
  });

  /**
   * 外部からの currentPageIndex 変更または表示モード（mode）の切り替えをスクロール位置へ同期します。
   */
  $effect(() => {
    if (mode === 'scroll' && slideHeight > 0) {
      if (lastPageIndex === undefined) {
        lastPageIndex = currentPageIndex;
      }
      if (currentPageIndex !== lastPageIndex || mode !== prevMode) {
        const targetTop = currentPageIndex * slideHeight * scale;
        if (Math.abs(scrollTop - targetTop) > 1) {
          scrollTop = targetTop;
        }
        lastPageIndex = currentPageIndex;
        prevMode = mode;
      }
    } else {
      prevMode = mode;
    }
  });

  /**
   * mode === 'slide' の際、currentPageIndex の変更を lastPageIndex に同期し、
   * mode === 'scroll' に切り替わった際のスクロール不整合を防ぎます。
   */
  $effect(() => {
    if (mode === 'slide') {
      lastPageIndex = currentPageIndex;
    }
  });

  /**
   * 親コンテナのスクロールイベントハンドラー。
   * スクロール位置を等倍基準に逆算して iframe 内部へ動的に同期します。
   */
  function handleWrapperScroll() {
    if (!tickingWrapper) {
      window.requestAnimationFrame(() => {
        if (!wrapperRef) {
          tickingWrapper = false;
          return;
        }
        const targetTop = wrapperRef.scrollTop;
        const targetLeft = wrapperRef.scrollLeft;

        scrollTop = targetTop;
        scrollLeft = targetLeft;

        const win = iframeRef?.contentWindow;
        if (win && scale > 0 && typeof win.scrollTo === 'function') {
          win.scrollTo({
            top: targetTop / scale,
            left: targetLeft / scale
          });
        }

        if (onscroll) onscroll(targetTop, targetLeft);
        tickingWrapper = false;
      });
      tickingWrapper = true;
    }
  }

  /**
   * iframe内部のスクロールイベントハンドラー。
   * 内部フォーカス移動等による自発的スクロールを検知し、決定論的ガードを経て親側へ逆同期します。
   */
  function handleIframeScroll() {
    if (!tickingIframe) {
      window.requestAnimationFrame(() => {
        const win = iframeRef?.contentWindow;
        const doc = iframeRef?.contentDocument;
        if (!win || !doc) {
          tickingIframe = false;
          return;
        }

        const currentIframeTop = doc.documentElement.scrollTop || doc.body.scrollTop;
        const currentIframeLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;

        const expectedParentTop = currentIframeTop * scale;
        const expectedParentLeft = currentIframeLeft * scale;

        if (Math.abs(scrollTop - expectedParentTop) > 1 || Math.abs(scrollLeft - expectedParentLeft) > 1) {
          scrollTop = expectedParentTop;
          scrollLeft = expectedParentLeft;
          
          if (wrapperRef) {
            if (typeof wrapperRef.scrollTo === 'function') {
              wrapperRef.scrollTo({ top: expectedParentTop, left: expectedParentLeft });
            } else {
              wrapperRef.scrollTop = expectedParentTop;
              wrapperRef.scrollLeft = expectedParentLeft;
            }
          }
          if (onscroll) onscroll(expectedParentTop, expectedParentLeft);
        }
        tickingIframe = false;
      });
      tickingIframe = true;
    }
  }

  /**
   * iframeの初期環境構築、および各種イベントリスナーのライフサイクル管理。
   */
  $effect(() => {
    if (!iframeRef) return;
    const win = iframeRef.contentWindow;
    const doc = iframeRef.contentDocument;
    if (!win || !doc) return;

    doc.body.style.margin = '0';
    doc.body.style.padding = '0';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (onkeydown) onkeydown(e);
    };

    win.addEventListener('scroll', handleIframeScroll, { passive: true });
    win.addEventListener('keydown', handleKeyDown);

    return () => {
      win.removeEventListener('scroll', handleIframeScroll);
      win.removeEventListener('keydown', handleKeyDown);
    };
  });

  /**
   * データや表示モードの変更を検知し、iframe内のHTML構造を再構築およびサイズ計測するライフサイクル。
   * ハイブリッド同期を成立させるため、iframe内部のbodyにもコンテンツの等倍総サイズを明示的に付与します。
   */
  $effect(() => {
    if (!iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc) return;

    const scrollbarHideStyle = `
      <style>
        ::-webkit-scrollbar { display: none; }
        html { -ms-overflow-style: none; scrollbar-width: none; }
      </style>
    `;

    const optimizedCommons = [...data.commons, scrollbarHideStyle];
    if (mode === 'scroll') {
      optimizedCommons.unshift(`
        <style>
          section.page {
            content-visibility: auto;
            contain-intrinsic-size: ${slideWidth}px ${slideHeight}px;
          }
        </style>
      `);
    }

    const commonsHtml = optimizedCommons.join('\n');
    const contentHtml = mode === 'scroll' 
      ? data.pages.join('\n') 
      : (data.pages[currentPageIndex] ?? '');
    const attrs = Object.entries(data.containerAttrs)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');

    const containerStyle = `width: ${totalInternalWidth}px; height: ${totalInternalHeight}px; position: relative; overflow: hidden;`;

    doc.body.innerHTML = `<div ${attrs} style="${containerStyle}">${commonsHtml}\n${contentHtml}</div>`;
    doc.body.style.width = `${totalInternalWidth}px`;
    doc.body.style.height = `${totalInternalHeight}px`;
    doc.body.style.overflow = 'auto';

    const firstPage = doc.querySelector('section.page') as HTMLElement | null;
    if (firstPage) {
      const w = firstPage.offsetWidth || 1920;
      const h = firstPage.offsetHeight || 1080;
      if (slideWidth !== w || slideHeight !== h || !hasMeasured) {
        slideWidth = w;
        slideHeight = h;
        hasMeasured = true;
      }
    }
  });

  /**
   * 外部から直接更新された位置状態（scrollTop / scrollLeft）を、親コンテナおよび iframe 内部へ強制同期するライフサイクル。
   */
  $effect(() => {
    if (!wrapperRef) return;
    if (Math.abs(wrapperRef.scrollTop - scrollTop) > 1 || Math.abs(wrapperRef.scrollLeft - scrollLeft) > 1) {
      if (typeof wrapperRef.scrollTo === 'function') {
        wrapperRef.scrollTo({ top: scrollTop, left: scrollLeft });
      } else {
        wrapperRef.scrollTop = scrollTop;
        wrapperRef.scrollLeft = scrollLeft;
      }
    }

    const win = iframeRef?.contentWindow;
    if (win && scale > 0 && typeof win.scrollTo === 'function') {
      const targetTop = scrollTop / scale;
      const targetLeft = scrollLeft / scale;
      const doc = win.document;
      const currentTop = doc.documentElement.scrollTop || doc.body.scrollTop;
      const currentLeft = doc.documentElement.scrollLeft || doc.body.scrollLeft;
      if (Math.abs(currentTop - targetTop) > 1 || Math.abs(currentLeft - targetLeft) > 1) {
        win.scrollTo({ top: targetTop, left: targetLeft });
      }
    }
  });
</script>

<div
  bind:this={wrapperRef}
  class="canvas-wrapper"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  style:width={width === 'fit-content' ? `${totalInternalWidth * scale}px` : width}
  style:height={height === 'fit-content' ? `${totalInternalHeight * scale}px` : height}
  onscroll={handleWrapperScroll}
>
  <div
    class="scroll-filler"
    style:width="{totalInternalWidth * scale}px"
    style:height="{totalInternalHeight * scale}px"
  ></div>

  <iframe
    bind:this={iframeRef}
    title="Slide Render Space"
    class="slide-canvas"
    style="
      width: {scale > 0 ? containerWidth / scale : containerWidth}px;
      height: {scale > 0 ? containerHeight / scale : containerHeight}px;
      transform: scale({scale});
      opacity: {hasMeasured ? 1 : 0};
    "
  ></iframe>
</div>

<style>
  .canvas-wrapper {
    position: relative;
    overflow: auto;
    box-sizing: border-box;
  }

  .scroll-filler {
    pointer-events: none;
    position: absolute;
    top: 0;
    left: 0;
  }

  .slide-canvas {
    border: none;
    position: sticky;
    top: 0;
    left: 0;
    transform-origin: top left;
    transition: opacity 0.15s ease;
    pointer-events: auto;
  }
</style>