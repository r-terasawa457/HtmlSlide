/**
 * 各実行環境におけるシステムアセットの調達・解決を行うプロバイダーのインターフェース
 */
export interface IAssetProvider {
  /**
   * 指定された静的アセットパスを、現在の環境でブラウザが解釈可能なURLに解決する
   * @param path - 静的アセットの相対パス
   * @returns ブラウザで直接利用可能なURL文字列のPromise
   */
  resolveAssetUrl(path: string): Promise<string>;

  /**
   * 指定されたCSSファイルを、現在の環境に最適なHTMLタグ形式に解決する
   * @param path - スタイルシートの相対パス
   * @returns 展開可能なHTMLタグ文字列のPromise
   */
  resolveStyleTag(path: string): Promise<string>;

  /**
   * 指定されたテーマCSSの生テキスト内容を解決する
   * @param name - テーマ名、またはテーマファイルのパス
   * @returns CSSの生テキスト内容のPromise
   */
  resolveThemeCss(name: string): Promise<string>;

  /**
   * 💡 注入されたすべての組み込みテーマCSSを解決し、オブジェクトマップとして返却する
   * @returns テーマパスをキー、CSS生テキストを値とするオブジェクトのPromise
   */
  resolveAllBuiltinThemes(): Promise<Record<string, string>>;

  /**
   * 指定された静的アセットのテキスト内容を直接解決する
   * @param path - 静的アセットの相対パス
   * @returns テキスト内容のPromise
   */
  resolveAssetContent(path: string): Promise<string>;

  /**
   * 指定されたJSファイルを、現在の環境に最適なHTMLスクリプトタグ形式に解決する
   * @param path - 静的アセットの相対パス
   * @returns 展開可能なHTMLスクリプトタグ文字列のPromise
   */
  resolveScriptTag(path: string): Promise<string>;

  /**
   * テンプレートHTML内の静的アセット参照（src/href）を現在の環境に合わせて自動解決し、起動URLを返却する
   * @param templatePath - テンプレートHTMLの相対パス
   * @returns 結合・解決されたHTMLのBlob URLのPromise
   */
  resolveCompositeHtmlUrl(templatePath: string): Promise<string>;
}
