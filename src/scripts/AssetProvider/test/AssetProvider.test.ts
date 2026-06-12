import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { Window } from "happy-dom";
import { httpProvider } from "../httpProvider";
import { portableProvider } from "../portableProvider";

const window = new Window({ url: "http://localhost:3000" });
Object.assign(globalThis, {
  window,
  document: window.document,
  DOMParser: window.DOMParser,
  URL: window.URL,
});

let createObjectURLMock = mock((_blob: Blob) => "blob:mock-url");
globalThis.URL.createObjectURL = createObjectURLMock;

describe("httpProvider", () => {
  let fetchMock = mock(() => Promise.resolve(new Response("")));
  globalThis.fetch = fetchMock as any;

  beforeEach(() => {
    fetchMock.mockClear();
    createObjectURLMock.mockClear();
  });

  test("resolveAssetUrl: 基準オリジンと結合された絶対URLが返却されること", async () => {
    const url = await httpProvider.resolveAssetUrl("assets/logo.png");
    expect(url).toBe("http://localhost:3000/assets/logo.png");
  });

  test("resolveStyleTag: 外部参照リンクタグが生成されること", async () => {
    const tag = await httpProvider.resolveStyleTag("css/main.css");
    expect(tag).toBe(
      '<link rel="stylesheet" href="http://localhost:3000/css/main.css" />',
    );
  });

  test("resolveScriptTag: 外部参照スクリプトタグが生成されること", async () => {
    const tag = await httpProvider.resolveScriptTag("js/app.js");
    expect(tag).toBe(
      '<script type="module" src="http://localhost:3000/js/app.js"></script>',
    );
  });

  test("resolveAssetContent: fetchが成功したときにテキスト内容を返すこと", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("content-text", { status: 200 })),
    );
    const content = await httpProvider.resolveAssetContent("data.txt");
    expect(content).toBe("content-text");
    expect(fetchMock).toHaveBeenCalledWith("/data.txt");
  });

  test("resolveAssetContent [Edge Case]: fetchが失敗（404等）したとき例外をスローすること", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response("", { status: 404 })),
    );
    expect(httpProvider.resolveAssetContent("missing.txt")).rejects.toThrow(
      "Failed to fetch asset content: missing.txt",
    );
  });

  test("resolveCompositeHtmlUrl [Edge Case]: 各種パス（相対、ルート相対、絶対）の書き換え判定が正しいこと", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="css/relative.css" />
        <link rel="stylesheet" href="/absolute-root.css" />
        <link rel="stylesheet" href="http://example.com/external.css" />
      </head>
      <body>
        <script src="js/relative.js"></script>
        <script src="/absolute-root.js"></script>
        <script src="https://example.com/external.js"></script>
        <script></script>
      </body>
      </html>
    `;
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(mockHtml, { status: 200 })),
    );

    await httpProvider.resolveCompositeHtmlUrl("index.html");

    expect(createObjectURLMock).toHaveBeenCalled();
    const passedBlob = createObjectURLMock.mock.calls[0]![0] as Blob;
    const processedHtml = await passedBlob.text();

    expect(processedHtml).toContain(
      'href="http://localhost:3000/css/relative.css"',
    );
    expect(processedHtml).toContain('href="/absolute-root.css"');
    expect(processedHtml).toContain('href="http://example.com/external.css"');
    expect(processedHtml).toContain(
      'src="http://localhost:3000/js/relative.js"',
    );
    expect(processedHtml).toContain('src="/absolute-root.js"');
    expect(processedHtml).toContain('src="https://example.com/external.js"');
  });
});

describe("portableProvider", () => {
  beforeEach(() => {
    (globalThis as any).EmbeddedAssets = {
      "index.html":
        "<!DOCTYPE html><html><head><link rel='stylesheet' href='./css/style.css'></head><body><script src='js/app.js'></script></body></html>",
      "css/style.css": "body { color: red; }",
      "js/app.js": "console.log('test');",
      "text.txt": "plain text",
    };
    createObjectURLMock.mockClear();
  });

  afterEach(() => {
    delete (globalThis as any).EmbeddedAssets;
  });

  test("resolveAssetUrl [Edge Case]: 拡張子に応じて適切なMIMEタイプでBlobが生成され、2回目はキャッシュが使われること", async () => {
    createObjectURLMock.mockImplementation((_blob: Blob) => "blob:dynamic-url");

    const urlHtml = await portableProvider.resolveAssetUrl("index.html");
    const passedBlobHtml = createObjectURLMock.mock.calls[0]![0] as Blob;
    expect(passedBlobHtml.type).toContain("text/html");
    expect(urlHtml).toBe("blob:dynamic-url");

    await portableProvider.resolveAssetUrl("css/style.css");
    const passedBlobCss = createObjectURLMock.mock.calls[1]![0] as Blob;
    expect(passedBlobCss.type).toContain("text/css");

    await portableProvider.resolveAssetUrl("js/app.js");
    const passedBlobJs = createObjectURLMock.mock.calls[2]![0] as Blob;
    // application/javascript と text/javascript の両方を許容するため、toContain に変更
    expect(passedBlobJs.type).toContain("javascript");

    await portableProvider.resolveAssetUrl("text.txt");
    const passedBlobTxt = createObjectURLMock.mock.calls[3]![0] as Blob;
    expect(passedBlobTxt.type).toContain("text/plain");

    createObjectURLMock.mockClear();
    const cachedUrl = await portableProvider.resolveAssetUrl("index.html");
    expect(cachedUrl).toBe("blob:dynamic-url");
    expect(createObjectURLMock).not.toHaveBeenCalled();
  });

  test("resolveAssetUrl [Edge Case]: EmbeddedAssetsに存在しない資産の場合、例外をスローすること", async () => {
    expect(portableProvider.resolveAssetUrl("not-found.js")).rejects.toThrow(
      "Asset not found in EmbeddedAssets: not-found.js",
    );
  });

  test("resolveStyleTag: スタイルシートの内容が直接インライン展開されること", async () => {
    const tag = await portableProvider.resolveStyleTag("css/style.css");
    expect(tag).toBe("<style>body { color: red; }</style>");
  });

  test("resolveScriptTag: スクリプトの内容が直接インライン展開されること", async () => {
    const tag = await portableProvider.resolveScriptTag("js/app.js");
    expect(tag).toBe("<script type=\"module\">console.log('test');</script>");
  });

  test("resolveCompositeHtmlUrl [Edge Case]: パスの正規化（./ の除去）が行われ、外部参照は無視されてインライン化されること", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="./css/style.css" />
        <link rel="stylesheet" href="http://example.com/external.css" />
      </head>
      <body>
        <script src="js/app.js"></script>
        <script src="/external.js"></script>
      </body>
      </html>
    `;
    (globalThis as any).EmbeddedAssets["custom-index.html"] = mockHtml;

    await portableProvider.resolveCompositeHtmlUrl("custom-index.html");

    const passedBlob = createObjectURLMock.mock.calls[0]![0] as Blob;
    const processedHtml = await passedBlob.text();

    expect(processedHtml).toContain("<style>body { color: red; }</style>");
    expect(processedHtml).toContain(
      '<link rel="stylesheet" href="http://example.com/external.css"',
    );
    expect(processedHtml).toContain(
      "<script type=\"module\">console.log('test');</script>",
    );
    expect(processedHtml).toContain('<script src="/external.js"');
  });

  test("resolveCompositeHtmlUrl [Edge Case]: 該当する資産がEmbeddedAssetsにないタグは、インライン化されずスキップされること", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
      <body>
        <script src="js/missing.js"></script>
      </body>
      </html>
    `;
    (globalThis as any).EmbeddedAssets["missing-test.html"] = mockHtml;

    await portableProvider.resolveCompositeHtmlUrl("missing-test.html");

    const passedBlob = createObjectURLMock.mock.calls[0]![0] as Blob;
    const processedHtml = await passedBlob.text();

    expect(processedHtml).toContain('<script src="js/missing.js"');
  });
});
