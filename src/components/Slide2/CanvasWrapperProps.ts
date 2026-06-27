import type { ParsedSlideData } from "./types";

export type CanvasWrapperProps = {
  // --- スライドコンテンツ & スタイル設定（単方向受け取り） ---
  data: ParsedSlideData;
  mode: "scroll" | "slide";
  currentPageIndex: number;
  fitMode: "contain" | "width" | "viewport" | "none";
  scrollbarMode: "auto" | "always" | "hidden";
  backdropColor: string;
  boxShadow: string;
  slideGap: number;

  // --- 親側ですべて計算済みの「物理ピクセル値」（そのままDOMにマッピング） ---
  scale: number;
  offsetX: number;
  offsetY: number;
  scrollFillerWidth: number; // 親が計算した総内寸幅 × scale
  scrollFillerHeight: number; // 親が計算した総内寸高 × scale
  iframeWidth: number; // 親が計算した等倍ビューポート幅 (containerWidth / scale)
  iframeHeight: number; // 親が計算した等倍ビューポート高 (containerHeight / scale)

  laserIsActive: boolean;

  /** 親側でViewport相対にダイレクト計算されたレーザーの物理座標（領域外は -1） */
  laserPhysicalX: number;
  /** 親側でViewport相対にダイレクト計算されたレーザーの物理座標（領域外は -1） */
  laserPhysicalY: number;

  // --- スクロール位置の制御（双方向 / スナップ等で親からの強制上書きに対応） ---
  scrollTop: number;
  scrollLeft: number;

  // --- 純粋な生イベントの透過（バブルアップ） & 状態通知 ---
  onscroll: (scrollTop: number, scrollLeft: number) => void;
  onmousemove: (e: MouseEvent) => void;
  onmouseleave: () => void;
  onkeydown?: (e: KeyboardEvent) => void;

  /** 初回マウント・レンダリング時に、スライド本来の解像度（1枚分）を親に報告する */
  onMeasuredSize: (width: number, height: number, totalHeight: number) => void;
};
