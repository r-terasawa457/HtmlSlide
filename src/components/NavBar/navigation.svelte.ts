import type { Snippet } from "svelte";

/**
 * ナビゲーションバーの右側に表示するアクションボタンの仕様
 */
export interface NavAction {
  id: string;
  label: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  action: () => void;
}

/**
 * ナビゲーションバーの中央領域と右側領域の状態を管理するクラス
 */
export class NavigationRegistry {
  #centerContent = $state<Snippet | null>(null);
  #rightActions = $state<NavAction[]>([]);

  get centerContent() {
    return this.#centerContent;
  }
  set centerContent(value: Snippet | null) {
    this.#centerContent = value;
  }

  get rightActions() {
    return this.#rightActions;
  }
  set rightActions(value: NavAction[]) {
    this.#rightActions = value;
  }
}

export const NAVIGATION_KEY = Symbol("NAVIGATION_KEY");
