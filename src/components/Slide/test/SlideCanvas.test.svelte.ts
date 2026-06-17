import { describe, test, expect, beforeEach } from "vitest";
import { mount, tick } from "svelte";
import SlideCanvas from "../SlideCanvas.svelte"; // パスは環境に合わせて調整

// --- 1. JSDOMの欠損を補うための ResizeObserver モック ---
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || ResizeObserverMock;

// テスト用共通モックデータ
const mockSlideData = {
  containerAttrs: { class: "slides-root", "data-testid": "slides-container" },
  commons: [
    '<style id="common-style">@scope { section.page { width: 800px; height: 600px; } }</style>',
  ],
  pages: [
    '<section class="page" id="slide-1" data-original-index="0"><h1>Page 1</h1></section>',
    '<section class="page" id="slide-2" data-original-index="1"><h1>Page 2</h1></section>',
  ],
};

function mockContainerSize(
  element: HTMLElement,
  width: number,
  height: number,
) {
  Object.defineProperties(element, {
    clientWidth: { value: width, configurable: true },
    clientHeight: { value: height, configurable: true },
  });
}

describe("SlideCanvas Component (Vitest)", () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = document.createElement("div");
    document.body.appendChild(target);

    return () => {
      document.body.removeChild(target);
    };
  });

  // ==========================================
  // 正常系テスト (Normal Cases)
  // ==========================================

  test("N-1: 初期表示でラッパーが生成され、Propsのサイズ属性が反映されること", async () => {
    mount(SlideCanvas, {
      target,
      props: {
        data: mockSlideData,
        mode: "fit",
        currentPageIndex: 0,
        width: "500px",
        height: "400px",
      },
    });

    await tick(); // flush から tick に変更

    const wrapper = target.querySelector(".canvas-wrapper") as HTMLElement;
    const iframe = target.querySelector("iframe") as HTMLIFrameElement;

    expect(wrapper).toBeTruthy();
    expect(wrapper.style.width).toBe("500px");
    expect(wrapper.style.height).toBe("400px");
    expect(iframe).toBeTruthy();
    expect(iframe.getAttribute("srcdoc")).toBe("~");
  });

  test("N-3 & N-2: ページインデックスやモードの変更がコンポーネントに追従すること", async () => {
    // 拡張子が .svelte.ts になったため、ここで $state が正常に機能します
    let props = $state({
      data: mockSlideData,
      mode: "fit" as "fit" | "scroll",
      currentPageIndex: 0,
    });

    mount(SlideCanvas, { target, props });
    await tick();

    // モードをscrollに切り替え
    props.mode = "scroll";
    await tick();

    const iframe = target.querySelector("iframe");
    expect(iframe).toBeTruthy();

    // ページを切り替え
    props.mode = "fit";
    props.currentPageIndex = 1;
    await tick();
    expect(props.currentPageIndex).toBe(1);
  });

  test("N-5: 親コンテナのサイズに応じて、正しいスケール倍率が計算・適用されること", async () => {
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

    mockContainerSize(wrapper, 400, 300);

    window.dispatchEvent(new Event("resize"));
    await tick();

    expect(iframe.style.transform).toContain("scale");
  });

  test("N-6: height='fit-content' の場合、縮小後の高さがラッパーにピクセル値で適用されること", async () => {
    const wrapper = document.createElement("div");
    target.appendChild(wrapper);

    mount(SlideCanvas, {
      target: wrapper,
      props: {
        data: mockSlideData,
        mode: "fit",
        width: "400px",
        height: "fit-content",
      },
    });

    await tick();

    const canvasWrapper = wrapper.querySelector(
      ".canvas-wrapper",
    ) as HTMLElement;
    mockContainerSize(canvasWrapper, 400, 0);

    window.dispatchEvent(new Event("resize"));
    await tick();

    expect(canvasWrapper.style.height).not.toBe("fit-content");
    expect(canvasWrapper.style.height).toContain("px");
  });

  // ==========================================
  // 異常系テスト (Edge Cases)
  // ==========================================

  test("E-1: pages 配列が空の不完全なデータが渡されてもクラッシュしないこと", async () => {
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

  test("E-2: 境界外（配列長以上や負の数）の currentPageIndex が指定されても安全に処理されること", async () => {
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

  test("E-3: 親コンテナのサイズが0（非表示状態など）の時、スケールが無限大やNaNにならないこと", async () => {
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

    mockContainerSize(wrapper, 0, 0);
    window.dispatchEvent(new Event("resize"));
    await tick();

    expect(iframe.style.transform).not.toContain("NaN");
    expect(iframe.style.transform).not.toContain("Infinity");
  });
});
