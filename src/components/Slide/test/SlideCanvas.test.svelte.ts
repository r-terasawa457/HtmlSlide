import { describe, test, expect, beforeEach, vi } from "vitest";
import { mount, tick } from "svelte";
import SlideCanvas from "../SlideCanvas.svelte";

/**
 * 要素ごとの全ResizeObserverコールバックを保持するマップ
 */
const observerMap = new Map<HTMLElement, Set<(entries: any[]) => void>>();

class ResizeObserverMock {
  private cb: (entries: any[]) => void;
  constructor(cb: (entries: any[]) => void) {
    this.cb = cb;
  }
  observe(element: HTMLElement) {
    if (!observerMap.has(element)) {
      observerMap.set(element, new Set());
    }
    observerMap.get(element)!.add(this.cb);

    this.cb([
      {
        target: element,
        contentRect: {
          width: element.clientWidth,
          height: element.clientHeight,
          top: 0,
          left: 0,
          bottom: element.clientHeight,
          right: element.clientWidth,
          x: 0,
          y: 0,
        },
        borderBoxSize: [
          { inlineSize: element.clientWidth, blockSize: element.clientHeight },
        ],
        contentBoxSize: [
          { inlineSize: element.clientWidth, blockSize: element.clientHeight },
        ],
      },
    ]);
  }
  unobserve(element: HTMLElement) {
    observerMap.get(element)?.delete(this.cb);
  }
  disconnect() {
    observerMap.clear();
  }
}
globalThis.ResizeObserver =
  globalThis.ResizeObserver || (ResizeObserverMock as any);

let mockPageWidth = 800;
let mockPageHeight = 600;

/**
 * 指定されたプロトタイプに対してスライドサイズ計測用のゲッターを注入する
 * @param proto - 対象となる要素のプロトタイプオブジェクト
 */
function injectLayoutMock(proto: any) {
  if (proto.hasOwnProperty("offsetWidth")) return;

  Object.defineProperty(proto, "offsetWidth", {
    get() {
      if (this.classList.contains("page")) return mockPageWidth;
      return 0;
    },
    configurable: true,
  });

  Object.defineProperty(proto, "offsetHeight", {
    get() {
      if (this.classList.contains("page")) return mockPageHeight;
      return 0;
    },
    configurable: true,
  });
}

injectLayoutMock(HTMLElement.prototype);

/**
 * iframeが生成された際、その内部ウィンドウのプロトタイプにも透過的にモックを適用するパッチ
 */
const iframeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLIFrameElement.prototype,
  "contentWindow",
);
if (iframeDescriptor && iframeDescriptor.get) {
  const originalGet = iframeDescriptor.get;
  Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
    get() {
      const win = originalGet.call(this);
      if (win && win.HTMLElement) {
        injectLayoutMock(win.HTMLElement.prototype);
      }
      return win;
    },
    configurable: true,
  });
}

/**
 * テスト用の構造化スライド共通データ
 */
const mockSlideData = {
  containerAttrs: { class: "slides-root", "data-testid": "slides-container" },
  commons: [
    '<style id="common-style">section.page { width: 800px; height: 600px; }</style>',
  ],
  pages: [
    '<section class="page" id="slide-1"><h1>Page 1</h1></section>',
    '<section class="page" id="slide-2"><h1>Page 2</h1></section>',
  ],
};

/**
 * 登録されているすべてのコールバックに対して完全なエントリ構造を偽装して通知する
 */
function triggerResize(element: HTMLElement, width: number, height: number) {
  Object.defineProperties(element, {
    clientWidth: { value: width, configurable: true },
    clientHeight: { value: height, configurable: true },
  });
  const callbacks = observerMap.get(element);
  if (callbacks) {
    const entry = {
      target: element,
      contentRect: {
        width,
        height,
        top: 0,
        left: 0,
        bottom: height,
        right: width,
        x: 0,
        y: 0,
      },
      borderBoxSize: [{ inlineSize: width, blockSize: height }],
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
    };
    callbacks.forEach((cb) => cb([entry]));
  }
}

describe("SlideCanvas Component (Vitest)", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);

    mockPageWidth = 800;
    mockPageHeight = 600;
    observerMap.clear();

    return () => {
      document.body.removeChild(target);
    };
  });

  test("N-1: 初期表示でラッパーおよびダミー領域が生成され、iframeへコンテンツHTMLが注入されること", async () => {
    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "slide",
        fit_mode: "contain",
        width: "500px",
        height: "400px",
      },
    });

    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const filler = target.querySelector(".scroll-filler") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;

    expect(wrapper).toBeTruthy();
    expect(filler).toBeTruthy();
    expect(iframe).toBeTruthy();
    expect(wrapper.style.width).toBe("500px");
    expect(wrapper.style.height).toBe("400px");

    const doc = iframe.contentDocument;
    expect(doc?.body.innerHTML).toContain("slides-root");
    expect(doc?.body.innerHTML).toContain("Page 1");
  });

  test("N-2: モード変更を検知してiframe内のDOM構成および content-visibility 最最適化スタイルが更新されること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "slide" as "slide" | "scroll",
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.contentDocument?.body.innerHTML).toContain("Page 1");

    props.mode = "scroll";
    await tick();

    const bodyHtml = iframe.contentDocument?.body.innerHTML;
    expect(bodyHtml).toContain("Page 1");
    expect(bodyHtml).toContain("Page 2");
    expect(bodyHtml).toContain("content-visibility: auto");
    expect(bodyHtml).toContain("contain-intrinsic-size");
  });

  test("N-3: 外部から位置変数が変更された際、親ラッパーのスクロール位置および iframe 内部へ座標が同期されること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "scroll" as const,
      scrollTop: 0,
      scrollLeft: 0,
      scale: 1.0,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const win = iframe.contentWindow;
    if (win) {
      win.scrollTo = vi.fn();
    }

    props.scrollTop = 100;
    props.scrollLeft = 50;
    await tick();

    expect(wrapper.scrollTop).toBe(100);
    expect(wrapper.scrollLeft).toBe(50);
    expect(win?.scrollTo).toHaveBeenCalledWith({ top: 100, left: 50 });
  });

  test("N-4: 親コンテナのスクロールイベントが、逆算された座標として iframe 内部へ間引かれて流し込まれること", async () => {
    const onscrollMock = vi.fn();
    let props = $state({
      data: mockSlideData,
      mode: "scroll" as const,
      scale: 2.0,
      fit_mode: "none" as const,
      onscroll: onscrollMock,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const win = iframe.contentWindow;
    if (win) {
      win.scrollTo = vi.fn();
    }

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: any) => {
      cb();
      return 0;
    });

    Object.defineProperties(wrapper, {
      scrollTop: { value: 200, configurable: true },
      scrollLeft: { value: 100, configurable: true },
    });
    wrapper.dispatchEvent(new Event("scroll"));

    expect(onscrollMock).toHaveBeenCalledWith(200, 100);
    expect(win?.scrollTo).toHaveBeenCalledWith({ top: 100, left: 50 });

    vi.restoreAllMocks();
  });

  test.skip("N-5: 親コンテナのサイズと fit_mode に応じて、正しい倍率が計算・反映されること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "slide" as const,
      fit_mode: "contain" as "contain" | "width" | "none",
      width: "400px",
      height: "300px",
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;

    triggerResize(wrapper, 400, 300);
    await tick();
    expect(iframe.style.transform).toBe("scale(0.5)");

    props.fit_mode = "width";
    await tick();
    expect(iframe.style.transform).toBe("scale(0.5)");
  });

  test.skip("N-6: width/height='fit-content' の場合、スケール適用後の総コンテンツサイズがラッパーのインラインスタイルに追従すること", async () => {
    mockPageWidth = 1000;
    mockPageHeight = 500;

    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "slide",
        fit_mode: "none",
        scale: 0.5,
        width: "fit-content",
        height: "fit-content",
      },
    });

    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    expect(wrapper.style.width).toBe("500px");
    expect(wrapper.style.height).toBe("250px");
  });

  test("N-7: iframe 内部で発生したキーボードイベントが親のコールバックへリレーされること", async () => {
    const onkeydownMock = vi.fn();

    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        onkeydown: onkeydownMock,
      },
    });

    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const win = iframe.contentWindow;

    if (win) {
      const keyboardEvent = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        code: "ArrowRight",
        bubbles: true,
      });
      win.dispatchEvent(keyboardEvent);
    }

    expect(onkeydownMock).toHaveBeenCalledTimes(1);
    expect(onkeydownMock.mock.calls[0][0].key).toBe("ArrowRight");
  });

  test("E-1: pages 配列が空の不完全なデータ構造が渡されてもクラッシュしないこと", async () => {
    const brokenData = { containerAttrs: {}, commons: [], pages: [] };

    expect(() => {
      mount(SlideCanvas, {
        target,
        props: { data: brokenData },
      });
    }).not.toThrow();

    await tick();
  });

  test("E-2: 親コンテナのサイズが0の時、スケール倍率が NaN や Infinity にならず 1.0 にフォールバックすること", async () => {
    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        width: "0px",
        height: "0px",
      },
    });

    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;

    triggerResize(wrapper, 0, 0);
    await tick();

    expect(iframe.style.transform).not.toContain("NaN");
    expect(iframe.style.transform).not.toContain("Infinity");
    expect(iframe.style.transform).toBe("scale(1)");
  });

  test("E-3: onkeydown コールバック未指定時、内部キーイベントが発生しても例外をスローしないこと", async () => {
    mount(SlideCanvas, {
      target,
      props: { data: mockSlideData },
    });

    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const win = iframe.contentWindow;

    expect(() => {
      if (win) {
        win.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      }
    }).not.toThrow();
  });

  test("N-8: mode === 'scroll' のとき、scrollTop が変化すると currentPageIndex が同期（更新）されること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "scroll" as const,
      currentPageIndex: 0,
      scrollTop: 0,
      scale: 1.0,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    triggerResize(wrapper, 800, 600);
    await tick();

    // scrollTop を変更 (2枚目のスライド位置: slideHeight=600px * scale=1.0)
    props.scrollTop = 600;
    await tick();

    expect(props.currentPageIndex).toBe(1);
  });

  test.skip("N-9: mode === 'scroll' のとき、currentPageIndex が変更されると scrollTop が正しい位置まで自動スクロールすること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "scroll" as const,
      currentPageIndex: 0,
      scrollTop: 0,
      scale: 1.0,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    triggerResize(wrapper, 800, 600);
    await tick();

    // currentPageIndex を 1 に変更
    props.currentPageIndex = 1;
    await tick();

    expect(props.scrollTop).toBe(600);
  });
});
