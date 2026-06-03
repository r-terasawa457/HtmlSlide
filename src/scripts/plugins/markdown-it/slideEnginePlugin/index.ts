import MarkdownIt from "markdown-it";
import { MetaParser, type SlideEnv } from "./MetaParser.ts";
import { StructureTransformer } from "./StructureTransformer.ts";
import { VariableReplacer } from "./VariableReplacer.ts";

/**
 * SlideEngineのコア機能をmarkdown-itの拡張として統合するためのメインプラグイン。
 * 構文解析（初期メタ抽出）、構造変形（スライド分割・レイアウトパーツ注入）、
 * およびレンダリング（変数置換）の各フェーズを単一のパイプラインとして制御する。
 */
export function slideEnginePlugin(md: MarkdownIt): void {
  md.core.ruler.push("slide_meta_parser", (state) => {
    const env = state.env as SlideEnv;

    if (!env.variables) env.variables = {};
    if (!env.themeStyles) env.themeStyles = [];

    MetaParser.parse(state, env);
  });

  md.core.ruler.push("slide_structure_transformer", (state) => {
    const env = state.env as SlideEnv;
    StructureTransformer.transform(state, env);
  });

  VariableReplacer.inject(md);
}
