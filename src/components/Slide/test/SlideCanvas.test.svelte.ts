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
let mockScrollHeight = 1200;

Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
  get() {
    if (this.classList.contains("page")) return mockPageWidth;
    return 0;
  },
  configurable: true,
});

Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
  get() {
    if (this.classList.contains("page")) return mockPageHeight;
    return 0;
  },
  configurable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
  get() {
    if (this.tagName === "BODY") return mockScrollHeight;
    return 0;
  },
  configurable: true,
});

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
    mockScrollHeight = 1200;
    observerMap.clear();

    return () => {
      document.body.removeChild(target);
    };
  });

  test("N-1: 初期表示でラッパーが生成され、iframeへコンテンツHTMLが正しく注入されること", async () => {
    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "fit",
        width: "500px",
        height: "400px",
      },
    });

    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;

    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe("500px");
    expect(wrapper.style.height).toBe("400px");
    expect(iframe).toBeTruthy();

    const doc = iframe.contentDocument;
    expect(doc?.body.innerHTML).toContain("slides-root");
    expect(doc?.body.innerHTML).toContain("Page 1");
  });

  test("N-2: モードや表示ページの変更を検知してiframe内のDOM構成および最適化スタイルが更新されること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "fit" as "fit" | "scroll",
      currentPageIndex: 0,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    expect(iframe.contentDocument?.body.innerHTML).toContain("Page 1");
    expect(iframe.contentDocument?.body.innerHTML).not.toContain("Page 2");

    props.currentPageIndex = 1;
    await tick();
    expect(iframe.contentDocument?.body.innerHTML).toContain("Page 2");

    props.mode = "scroll";
    await tick();
    expect(iframe.contentDocument?.body.innerHTML).toContain("Page 1");
    expect(iframe.contentDocument?.body.innerHTML).toContain("Page 2");
    expect(iframe.contentDocument?.body.innerHTML).toContain(
      "content-visibility: auto",
    );
    expect(iframe.contentDocument?.body.innerHTML).toContain(
      "contain-intrinsic-size",
    );
  });

  test("N-3: 外部から scrollTop が変更された際、iframe 内部へ正しくスクロール位置が同期されること", async () => {
    let props = $state({
      data: mockSlideData,
      mode: "scroll" as "fit" | "scroll",
      scrollTop: 0,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const win = iframe.contentWindow;
    if (win) {
      win.scrollTo = vi.fn();
    }

    props.scrollTop = 150;
    await tick();

    expect(win?.scrollTo).toHaveBeenCalledWith({ top: 150 });
  });

  test("N-4: iframe 内部のネイティブスクロールが、親のステートおよびコールバック関数へ間引かれて通知されること", async () => {
    let currentScrollTop = 0;
    const onscrollMock = vi.fn((val) => {
      currentScrollTop = val;
    });

    let props = $state({
      data: mockSlideData,
      mode: "scroll" as "fit" | "scroll",
      scrollTop: 0,
      onscroll: onscrollMock,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const doc = iframe.contentDocument;

    if (doc) {
      Object.defineProperty(doc.documentElement, "scrollTop", {
        value: 250,
        configurable: true,
      });

      vi.spyOn(window, "requestAnimationFrame").mockImplementation(
        (cb: any) => {
          cb();
          return 0;
        },
      );

      iframe.contentWindow?.dispatchEvent(new Event("scroll"));
    }

    expect(onscrollMock).toHaveBeenCalledWith(250);
    vi.restoreAllMocks();
  });

  test("N-5: 親コンテナのサイズに応じて、歪みのない正しいアスペクト比スケールが計算・適用されること", async () => {
    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "fit",
        width: "400px",
        height: "300px",
      },
    });

    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;

    triggerResize(wrapper, 400, 300);
    await tick();

    expect(iframe.style.transform).toBe("scale(0.5)");
  });

  test("N-6: height='fit-content' の場合、レンダリング後の縮小高さがラッパーにピクセル固定値で追従すること", async () => {
    mockPageWidth = 1000;
    mockPageHeight = 500;

    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "fit",
        width: "400px",
        height: "fit-content",
      },
    });

    await tick();

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;

    triggerResize(wrapper, 400, 0);
    await tick();

    expect(wrapper.style.height).toBe("200px");
  });

  test("N-7: iframe 内部で発生したキーボードイベントが、親から提供された onkeydown コールバックへ正しくリレーされること", async () => {
    const onkeydownMock = vi.fn();

    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "fit",
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
    const brokenData = {
      containerAttrs: {},
      commons: [],
      pages: [],
    };

    expect(() => {
      mount(SlideCanvas, {
        target,
        props: {
          data: brokenData,
          mode: "fit",
          currentPageIndex: 0,
        },
      });
    }).not.toThrow();

    await tick();
  });

  test("E-2: 境界外（配列長以上など）のインデックスが指定されても安全にフォールバック処理されること", async () => {
    expect(() => {
      mount(SlideCanvas, {
        target,
        props: {
          data: mockSlideData,
          mode: "fit",
          currentPageIndex: 999,
        },
      });
    }).not.toThrow();

    await tick();
  });

  test("E-3: 親コンテナのサイズが0（要素非表示状態など）の時、スケール倍率が NaN や Infinity にならず安全に復帰すること", async () => {
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

  test("E-4: onkeydown コールバックが指定されていない不完全なProps環境下でも、iframe 内部でキーイベントが発生した際に例外がスローされないこと", async () => {
    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "fit",
      },
    });

    await tick();

    const iframe = target.querySelector("iframe") as HTMLIFrameElement;
    const win = iframe.contentWindow;

    expect(() => {
      if (win) {
        const keyboardEvent = new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
        });
        win.dispatchEvent(keyboardEvent);
      }
    }).not.toThrow();
  });
});
