/**
 * @file presenter.ts
 * @description ステージビュー（外部ディスプレイ用ウィンドウ）のエントリーポイント。
 * ルートコンポーネントである StageViewMain を検知したターゲット要素に対してマウントします。
 */
import { mount } from "svelte";
import StageViewMain from "../components/StageViewMain.svelte";

mount(StageViewMain, {
  target: document.body,
});
