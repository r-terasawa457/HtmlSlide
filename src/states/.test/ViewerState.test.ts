import { describe, test, expect, vi, beforeEach } from "vitest";
import { ViewerState, parseSlidesHtml } from "../ViewerState.svelte";
import { getAppState } from "../AppState.svelte";

// Mock AppState.svelte
const mockAppState = {
  isLoaded: true,
  title: "Test Title",
  slidesHtml: `<div class="slides" class-root="test" data-id="123">
    <style>body { color: red; }</style>
    <section class="page" id="slide-1"><h1>Page 1</h1></section>
    <section class="page" id="slide-2"><h1>Page 2</h1></section>
  </div>`,
  assetsMap: {} as Record<string, string>,
  presenterWindow: null as Window | null,
  isPrintRequested: false,
  requestPrint: vi.fn(),
  clearPrintRequest: vi.fn(),
};

vi.mock("../AppState.svelte", () => {
  return {
    AppState: class {},
    initAppState: () => mockAppState,
    getAppState: () => mockAppState,
  };
});

describe("parseSlidesHtml helper function", () => {
  test("should parse valid slide HTML correctly", () => {
    const rawHtml = `<div class="slides" data-test="container">
      <style>h1 { color: blue; }</style>
      <section class="page" id="slide-1"><h1>Slide 1</h1></section>
      <section class="page" id="slide-2"><h1>Slide 2</h1></section>
    </div>`;

    const result = parseSlidesHtml(rawHtml);

    expect(result.containerAttrs).toEqual({
      class: "slides",
      "data-test": "container",
    });
    expect(result.commons).toContain("<style>h1 { color: blue; }</style>");
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain('id="slide-1"');
    expect(result.pages[1]).toContain('id="slide-2"');
  });

  test("should handle empty or invalid HTML", () => {
    expect(parseSlidesHtml("")).toEqual({
      containerAttrs: {},
      commons: [],
      pages: [],
    });
    expect(parseSlidesHtml("<div>Invalid</div>")).toEqual({
      containerAttrs: {},
      commons: [],
      pages: [],
    });
  });
});

describe("ViewerState Class Tests", () => {
  let viewerState: ViewerState;

  beforeEach(() => {
    mockAppState.slidesHtml = `<div class="slides" class-root="test" data-id="123">
      <style>body { color: red; }</style>
      <section class="page" id="slide-1"><h1>Page 1</h1></section>
      <section class="page" id="slide-2"><h1>Page 2</h1></section>
    </div>`;
    viewerState = new ViewerState();
  });

  test("should load and parse slideData and compute totalPages from appState", () => {
    expect(viewerState.slideData.pages).toHaveLength(2);
    expect(viewerState.totalPages).toBe(2);
  });

  test("should correctly synchronize currentPageIndex and currentPage (1-based to 0-based)", () => {
    expect(viewerState.currentPage).toBe(1);
    expect(viewerState.currentPageIndex).toBe(0);

    viewerState.currentPageIndex = 1;
    expect(viewerState.currentPage).toBe(2);
    expect(viewerState.currentPageIndex).toBe(1);
  });

  test("should guard currentPageIndex setter against out of bound values", () => {
    viewerState.currentPageIndex = -1; // invalid, should be ignored
    expect(viewerState.currentPage).toBe(1);

    viewerState.currentPageIndex = 5; // invalid, exceeds total pages
    expect(viewerState.currentPage).toBe(1);
  });

  test("should guard currentPageIndex setter against identical values", () => {
    // Setting identical page should not update or crash
    viewerState.currentPageIndex = 0;
    expect(viewerState.currentPage).toBe(1);
  });

  test("should derive stageSyncData including the parsed slide data", () => {
    const syncData = viewerState.stageSyncData;
    expect(syncData.type).toBe("sync_stage");
    expect(syncData.currentPage).toBe(1);
    expect(syncData.data).toBeDefined();
    expect(syncData.data.pages).toHaveLength(2);
  });

  test("goToPage should change page and update navigationSignal", () => {
    viewerState.goToPage(2);
    expect(viewerState.currentPage).toBe(2);
    expect(viewerState.navigationSignal).toEqual({
      page: 2,
      source: "program",
    });

    // invalid page should be ignored
    viewerState.goToPage(3);
    expect(viewerState.currentPage).toBe(2);
  });

  test("changePageRelative should increment/decrement current page", () => {
    viewerState.changePageRelative(1);
    expect(viewerState.currentPage).toBe(2);

    viewerState.changePageRelative(-1);
    expect(viewerState.currentPage).toBe(1);
  });

  test("updatePageFromScroll should update page if different", () => {
    viewerState.updatePageFromScroll(2);
    expect(viewerState.currentPage).toBe(2);
    expect(viewerState.navigationSignal).toEqual({
      page: 2,
      source: "scroll",
    });

    // same page should not update signal
    viewerState.navigationSignal = { page: 2, source: "init" };
    viewerState.updatePageFromScroll(2);
    expect(viewerState.navigationSignal).toEqual({
      page: 2,
      source: "init",
    });
  });

  test("updateScrollTop should update the scroll top in context", () => {
    viewerState.updateScrollTop(150);
    expect(viewerState.modeContexts[viewerState.currentMode].scrollTop).toBe(
      150,
    );
  });

  test("switchViewMode should change view mode and update navigationSignal", () => {
    viewerState.switchViewMode("STANDALONE_PRES");
    expect(viewerState.currentMode).toBe("STANDALONE_PRES");
    expect(viewerState.navigationSignal).toEqual({
      page: 1,
      source: "program",
    });
  });
});
