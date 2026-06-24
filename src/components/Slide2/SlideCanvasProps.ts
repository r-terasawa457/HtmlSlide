import type { ParsedSlideData } from "./types";
import type { LaserInfo } from "./SlideGeometry";

export interface ViewportInfo {
  centerY: number;
  centerX: number;
  width: number;
  height: number;
}

/**
 * @type SlideCanvasProps
 * @description Svelte 5の先進的な双方向バインドと柔軟なフィットモードを備えた、汎用スライドキャンバスのProps仕様。
 */
export type SlideCanvasProps = {
  // --- レイアウト・外観（単方向入力 $state） ---
  data: ParsedSlideData;
  mode: "scroll" | "slide";
  width?: string;
  height?: string;
  slideGap?: number;
  boxShadow?: string;
  scrollbarMode?: "auto" | "always" | "hidden";
  fitMode?: "contain" | "width" | "viewport" | "none";

  // --- 状態の動的同期（Svelte 5 $bindable 対象フィールド） ---
  /** 現在アクティブなページインデックス（0始まり） */
  currentPageIndex?: number;
  /** 現在のスライド表示倍率（1.0が等倍） */
  scale?: number;
  /** 表示中の等倍ビューポート領域情報 */
  viewportInfo?: ViewportInfo;
  /** レーザーポインターの描画位置情報 */
  laserInfo?: LaserInfo;

  // --- レーザートラッキング・インタラクション（単方向入力 / Callback） ---
  /** マウス移動を捕捉してレーザー座標（laserInfo）を計算・通知するモードにするか */
  laserTracking?: boolean;
  /** laserTracking有効時、マウス移動によって計算された座標を通知するイベント */
  onLasermove?: (info: LaserInfo) => void;
  /** キャンバス（iframe内部）でキーボードが押下された際のエスケープ用イベント */
  onkeydown?: (e: KeyboardEvent) => void;

  // --- ライフサイクル・通知（単方向出力） ---
  /** 等倍空間における総描画寸法が確定・変更された際の通知（親ウィンドウの自動リサイズ用） */
  onContentSizeChange?: (contentWidth: number, contentHeight: number) => void;
};
