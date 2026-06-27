export interface ViewportInfo {
  centerY: number; // unscaled
  centerX: number;
  width: number;
  height: number;
}

export interface LaserInfo {
  unscaledX: number; // (領域外は -1)
  unscaledY: number; // (領域外は -1)
}

export interface SlideGeometryContext {
  containerWidth: number;
  containerHeight: number;
  pageWidth: number;
  pageHeight: number;
  mode: "scroll" | "slide";
  fitMode: "contain" | "width" | "viewport" | "none";
  scrollbarMode: "auto" | "always" | "hidden";
  systemScrollbarWidth: number;
  slideGap: number;
}

export interface SlideGeometryCalculated {
  effectiveWidth: number;
  scale: number;
}

/**
 * SlideCanvasにおけるすべての幾何計算・座標変換を行う静的関数集。
 */
export class SlideGeometry {
  /**
   * fitModeとScrollbarModeとpropScaleに応じて、スケールと有効な表示内寸幅を算出する。
   */
  static calculate(
    ctx: SlideGeometryContext,
    contentHeight: number,
    propScale: number,
  ): SlideGeometryCalculated {
    // scaleの計算(fitMode: width, containは仮)
    let scale = 0.0;
    if (ctx.fitMode === "none") {
      scale = propScale;
    } else if (ctx.fitMode === "viewport") {
      scale = propScale; // viewPortからの計算はここでは行わない
    } else if (ctx.pageWidth === 0 || ctx.pageHeight === 0) {
      scale = 1.0;
    } else if (ctx.fitMode === "width") {
      scale = ctx.containerWidth / ctx.pageWidth;
    } else if (ctx.fitMode === "contain") {
      scale = Math.min(
        ctx.containerWidth / ctx.pageWidth,
        ctx.containerHeight / ctx.pageHeight,
      );
    }

    // スクロールバー表示/非表示 -> effectriveWidth
    let effectiveWidth = ctx.containerWidth;
    if (
      ctx.scrollbarMode === "always" ||
      (contentHeight * scale > ctx.containerHeight &&
        ctx.scrollbarMode !== "hidden")
    ) {
      effectiveWidth = Math.max(
        0,
        ctx.containerWidth - ctx.systemScrollbarWidth,
      );
    }

    // fitMode: width, containの場合のスケール決定
    if (ctx.fitMode === "width") {
      scale = effectiveWidth / ctx.pageWidth;
    } else if (ctx.fitMode === "contain") {
      scale = Math.min(
        effectiveWidth / ctx.pageWidth,
        ctx.containerHeight / ctx.pageHeight,
      );
    }

    return { effectiveWidth: effectiveWidth, scale: scale };
  }

  /**
   * 影付き表示などによる等倍空間上での横方向パディングを算出する。
   */
  static calculatePaddingX(
    ctx: SlideGeometryContext,
    effectiveWidth: number,
    scale: number,
    shadowPaddingX: number,
  ): number {
    if (scale <= 0 || ctx.pageWidth === 0) {
      return 0;
    }
    const availableSpaceX = (effectiveWidth - ctx.pageWidth * scale) / 2;
    if (availableSpaceX <= 0) {
      return 0;
    }
    return Math.min(shadowPaddingX, availableSpaceX / scale);
  }

  /**
   * 余白がある場合に中央寄せ配置するための物理オフセット座標を算出する。
   */
  static calculateOffset(
    ctx: SlideGeometryContext,
    effectiveWidth: number,
    scrollFillerWidth: number,
    scrollFillerHeight: number,
  ): { x: number; y: number } {
    return {
      x:
        effectiveWidth > scrollFillerWidth
          ? (effectiveWidth - scrollFillerWidth) / 2
          : 0,
      y:
        ctx.containerHeight > scrollFillerHeight
          ? (ctx.containerHeight - scrollFillerHeight) / 2
          : 0,
    };
  }

  /**
   * 現在の物理スクロール量から、等倍空間上の視野を逆算する。
   */
  static calculateViewportInfo(
    ctx: SlideGeometryContext,
    scrollTop: number,
    scrollLeft: number,
    scale: number,
  ): ViewportInfo {
    const s = scale || 1.0;
    const wUnscaled = ctx.containerWidth / s;
    const hUnscaled = ctx.containerHeight / s;
    const xUnscaled = scrollLeft / s;
    const yUnscaled = scrollTop / s;

    return {
      centerX: xUnscaled + wUnscaled / 2,
      centerY: yUnscaled + hUnscaled / 2,
      width: wUnscaled,
      height: hUnscaled,
    };
  }

  /**
   * 遠隔の等倍視野を自身の画面内に完全に内包させるための、ターゲット物理スクロール位置と追従スケールを逆算する。
   */
  static calculateTargetScrollForViewport(
    ctx: SlideGeometryContext,
    remoteViewport: ViewportInfo,
  ): { scrollTop: number; scrollLeft: number; scale: number } {
    if (remoteViewport.width <= 0 || remoteViewport.height <= 0) {
      return { scrollTop: 0, scrollLeft: 0, scale: 1.0 };
    }

    const scale = Math.min(
      ctx.containerWidth / remoteViewport.width,
      ctx.containerHeight / remoteViewport.height,
    );
    const scrollTop =
      (remoteViewport.centerY - ctx.containerHeight / scale / 2) * scale;
    const scrollLeft =
      (remoteViewport.centerX - ctx.containerWidth / scale / 2) * scale;

    return { scrollTop, scrollLeft, scale };
  }

  /**
   * 指定されたページインデックスへスナップジャンプするためのターゲット物理スクロールY位置を逆算する。
   */
  static calculateTargetScrollForPage(
    ctx: SlideGeometryContext,
    pageIndex: number,
    currentPaddingY: number,
    scale: number,
  ): number {
    return (
      (currentPaddingY + pageIndex * (ctx.pageHeight + ctx.slideGap)) * scale
    );
  }

  /**
   * iframe内の生マウスイベント情報から、等倍空間上の絶対ピクセル座標を算出・検証する。
   */
  static calculateUnscaledMousePosition(
    clientX: number,
    clientY: number,
    iframeScrollLeft: number,
    iframeScrollTop: number,
    totalInternalWidth: number,
    totalInternalHeight: number,
  ): LaserInfo {
    const unscaledX = clientX + iframeScrollLeft;
    const unscaledY = clientY + iframeScrollTop;

    if (
      unscaledX < 0 ||
      unscaledX > totalInternalWidth ||
      unscaledY < 0 ||
      unscaledY > totalInternalHeight
    ) {
      return { unscaledX: -1, unscaledY: -1 };
    }

    return { unscaledX, unscaledY };
  }

  /**
   * 等倍絶対座標から、固定レイヤー基準の描画用物理ピクセル座標へダイレクトに変換する。
   */
  static calculatePhysicalLaserPosition(
    laser: LaserInfo,
    scale: number,
    scrollLeft: number,
    scrollTop: number,
    offsetX: number,
    offsetY: number,
  ): { x: number; y: number } {
    if (laser.unscaledX === -1 || laser.unscaledY === -1) {
      return { x: -1, y: -1 };
    }

    return {
      x: laser.unscaledX * scale - scrollLeft + offsetX,
      y: laser.unscaledY * scale - scrollTop + offsetY,
    };
  }
}
