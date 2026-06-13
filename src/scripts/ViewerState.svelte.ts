/**
 * ビューアー内の表示状態およびナビゲーションを統括するステート管理クラス (Svelte 5 Runes)
 */
export class ViewerState {
  currentPage = $state(1);
  totalPages = $state(0);
  currentZoom = $state(1.0);
  currentMode = $state<"ORIGINAL" | "CUSTOM" | "FIT_HEIGHT" | "FIT_WIDTH">(
    "FIT_HEIGHT",
  );
  slidesHtml = $state("");
  assetsMap = $state<Record<string, string>>({});
  title = $state("");
  presenterWindow = $state<Window | null>(null);

  zoomPercentage = $derived(`${Math.round(this.currentZoom * 100)}%`);

  /**
   * コンテナサイズを基に適切なズーム倍率を自動再計算する
   */
  updateLayout(vW: number, vH: number, baseW: number, baseH: number): void {
    if (this.currentMode === "ORIGINAL") {
      this.currentZoom = 1.0;
    } else if (this.currentMode === "FIT_WIDTH") {
      this.currentZoom = vW / baseW;
    } else if (this.currentMode === "FIT_HEIGHT") {
      let scale = vH / baseH;
      if (baseW * scale > vW) {
        scale = vW / baseW;
      }
      this.currentZoom = scale;
    }
  }
}

export const viewerState = new ViewerState();
