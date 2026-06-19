/**
 * @file stage_view.ts
 * @description ステージビュー（外部ディスプレイ用ウィンドウ）のエントリーポイント。
 * ルートコンポーネントである StageViewMain をマウントします。
 */
import { mount } from "svelte";
import StageViewMain from "../components/StageViewMain.svelte";

mount(StageViewMain, {
  target: document.body,
});
