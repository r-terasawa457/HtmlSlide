<script lang="ts">
  /**
   * @file SlideCanvas.svelte
   * @description スタイル隔離および content-visibility による最適化を施したスライドレンダラー。
   * 外部 Props とのスクロール位置（scrollTop）の双方向同期、および内部キーボードイベントの親ウィンドウへのリレーに対応しています。
   */

  import type { ParsedSlideData } from './types';

  /**
   * @typedef {Object} Props
   * @property {ParsedSlideData} data - パース済みの構造化スライドデータ
   * @property {'scroll' | 'fit'} [mode='fit'] - 表示モード
   * @property {number} [currentPageIndex=0] - 'fit' モード時の表示ページ番号
   * @property {string} [width='100%'] - コンテナ幅
   * @property {string} [height='100%'] - コンテナ高さ
   * @property {number} [scrollTop=0] - 'scroll' モード時のスクロール位置（px）
   * @property {(value: number) => void} [onscroll] - スクロール位置変更時のコールバック
   * @property {(e: KeyboardEvent) => void} [onkeydown] - iframe内部でキーボードイベントが発生した際のコールバック
   */
  let {
    data,
    mode = 'fit',
    currentPageIndex = 0,
    width = '100%',
    height = '100%',
    scrollTop = $bindable(0),
    onscroll,
    onkeydown
  } = $props<{
    data: ParsedSlideData;
    mode?: 'scroll' | 'fit';
    currentPageIndex?: number;
    width?: string;
    height?: string;
    scrollTop?: number;
    onscroll?: (value: number) => void;
    onkeydown?: (e: KeyboardEvent) => void;
  }>();

  let containerWidth = $state(0);
  let containerHeight = $state(0);
  let slideWidth = $state(1920);
  let slideHeight = $state(1080);
  let hasMeasured = $state(false);
  let iframeRef = $state<HTMLIFrameElement | null>(null);

  let ticking = false;

  let scale = $derived.by(() => {
    if (!hasMeasured || containerWidth === 0) return 1;
    if (height !== 'fit-content' && containerHeight === 0) return 1;
    if (slideWidth === 0 || slideHeight === 0) return 1;

    const scaleX = containerWidth / slideWidth;
    if (height === 'fit-content') return scaleX;

    const scaleY = containerHeight / slideHeight;
    return mode === 'fit' ? Math.min(scaleX, scaleY) : scaleX;
  });

  let renderedHeight = $derived(slideHeight * scale);

  /**
   * iframe内部のスクロールイベントハンドラー。
   * rAFを用いて通知を間引き、親のscrollTopと差分がある場合のみ更新を通知します。
   */
  function handleIframeScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const doc = iframeRef?.contentDocument;
        if (!doc) {
          ticking = false;
          return;
        }
        const currentScrollTop = doc.documentElement.scrollTop || doc.body.scrollTop;
 
        if (Math.abs(scrollTop - currentScrollTop) > 1) {
          scrollTop = currentScrollTop;
          if (onscroll) onscroll(currentScrollTop);
        }
        ticking = false;
      });
      ticking = true;
    }
  }

  /**
   * iframeの初期スタイル設定、環境構築、および各種イベントリスナーのライフサイクル管理。
   */
  $effect(() => {
    if (!iframeRef) return;
    const win = iframeRef.contentWindow;
    const doc = iframeRef.contentDocument;
    if (!win || !doc) return;

    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.width = 'fit-content';
    doc.body.style.height = 'fit-content';

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
   */
  $effect(() => {
    if (!iframeRef) return;
    const doc = iframeRef.contentDocument;
    if (!doc) return;

    doc.body.style.overflow = mode === 'scroll' ? 'auto' : 'hidden';

    const optimizedCommons = [...data.commons];
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

    doc.body.innerHTML = `<div ${attrs}>${commonsHtml}\n${contentHtml}</div>`;

    const firstPage = doc.querySelector('section.page') as HTMLElement | null;
    if (firstPage) {
      slideWidth = firstPage.offsetWidth;
      slideHeight = mode === 'scroll' ? doc.body.scrollHeight : firstPage.offsetHeight;
      hasMeasured = true;
    }
  });

  /**
   * 外部からのスクロール位置（scrollTop）の変更をiframe内部へ同期するライフサイクル。
   */
  $effect(() => {
    if (mode !== 'scroll' || !iframeRef) return;
    const win = iframeRef.contentWindow;
    if (!win) return;

    const current = win.document.documentElement.scrollTop || win.document.body.scrollTop;
    if (Math.abs(current - scrollTop) > 1) {
      win.scrollTo({ top: scrollTop });
    }
  });
</script>

<div
  class="canvas-wrapper"
  bind:clientWidth={containerWidth}
  bind:clientHeight={containerHeight}
  style:width={width}
  style:height={height === 'fit-content' ? `${renderedHeight}px` : height}
>
  <iframe
    bind:this={iframeRef}
    title="Slide Render Space"
    class="slide-canvas"
    style="
      width: {slideWidth}px;
      height: {slideHeight}px;
      transform: scale({scale});
      transform-origin: top left;
      opacity: {hasMeasured ? 1 : 0};
    "
  ></iframe>
</div>

<style>
  .canvas-wrapper {
    position: relative;
    overflow: hidden;
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