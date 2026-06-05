import MarkdownIt from "markdown-it";
import ColonBlockPlugin from "../ColonBlockPlugin";
import { MetaParser, type SlideEnv } from "./MetaParser.ts";
import { StructureTransformer } from "./StructureTransformer.ts";
import { VariableReplacer } from "./VariableReplacer.ts";
import { imageAssetPlugin } from "./ImageAssetPlugin.ts";

/**
 * スライド生成に必要な構文解析、構造変形、変数置換の全フェーズを統合するメインプラグイン。
 * 内部で依存するColonBlockPluginの自動有効化も含めてパイプラインをカプセル化します。
 * @param md - MarkdownItのインスタンス
 */
export function slideEnginePlugin(md: MarkdownIt): void {
  md.use(ColonBlockPlugin);
  md.use(imageAssetPlugin);

  md.core.ruler.push("slide_meta_parser", (state) => {
    const env = state.env as SlideEnv;

    if (!env.variables) env.variables = {};
    if (!env.themeStyles) env.themeStyles = [];

    if ((env as any).__metaParsed) return;
    (env as any).__metaParsed = true;

    MetaParser.parse(state, env);
  });

  md.core.ruler.push("slide_structure_transformer", (state) => {
    const env = state.env as SlideEnv;
    if ((env as any).__structured) return;
    (env as any).__structured = true;

    StructureTransformer.transform(state, env);
  });

  VariableReplacer.inject(md);
}

export type { SlideEnv } from "./MetaParser";
