import type { Component } from "svelte";

export interface PanelState {
  id: string;
  /** パネルにレンダリングするSvelteコンポーネント */
  component: Component<any>;
  /** コンポーネントに渡す初期Props */
  props?: Record<string, any>;
  title: string;
  isOpen: boolean;
  /** パネルの横幅（ピクセル） */
  width: number;
}

/**
 * アプリケーション内のパネルの配置、開閉、サイズ、およびライフサイクルを管理するクラス
 */
export class PanelManager {
  #panels = $state<PanelState[]>([]);

  get panels() {
    return this.#panels;
  }

  /**
   * 新しいパネルを登録する
   */
  register(panel: PanelState): void {
    if (this.#panels.some((p) => p.id === panel.id)) return;
    this.#panels.push(panel);
  }

  /**
   * パネルの登録を解除し、コンポーネントの参照をメモリから完全に破棄する
   */
  unregister(id: string): void {
    this.#panels = this.#panels.filter((p) => p.id !== id);
  }

  /**
   * 特定のパネルの開閉状態を切り替える
   */
  togglePanel(id: string): void {
    const panel = this.#panels.find((p) => p.id === id);
    if (panel) {
      panel.isOpen = !panel.isOpen;
    }
  }

  /**
   * 特定のパネルの幅を更新する
   */
  updateWidth(id: string, width: number): void {
    const panel = this.#panels.find((p) => p.id === id);
    if (panel) {
      panel.width = Math.max(100, width);
    }
  }
}

export const PANEL_MANAGER_KEY = Symbol("PANEL_MANAGER_KEY");
