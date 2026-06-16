/**
 * 登録する個別ショートカットの定義
 */
export interface ShortcutAction {
  /** モディファイアキーとキー名を結合した文字列（例: 'mod+s', 'ctrl+z', 'escape'） */
  key: string;
  /**
   * キーが押された際に実行されるコールバック関数
   * @returns trueを返すとイベントが消費されたとみなされ、下位レイヤーへの仮想バブリングを停止する
   */
  action: (e: KeyboardEvent) => boolean | void;
}

/**
 * ショートカットを管理するスコープの設定オプション
 */
export interface ScopeOptions {
  /** ショートカットの優先順位を決定するレイヤー */
  layer: "modal" | "view" | "global";
  /** このスコープ内で有効にするショートカットアクションのリスト */
  actions: ShortcutAction[];
}

/**
 * アプリケーション全体のキーボードショートカットを集中管理し、
 * 優先度付きのアクティブスタックと仮想バブリングを提供するレジストリ
 */
export class KeyboardEventRegistry {
  #scopes = new Map<string, ScopeOptions>();
  #modalStack = $state<string[]>([]);
  #viewStack = $state<string[]>([]);
  #isMac =
    typeof window !== "undefined" &&
    /Mac|iPhone|iPod|iPad/.test(navigator.userAgent);

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", this.#handleKeyDown.bind(this), true);
    }
  }

  /**
   * スコープとそのアクションを登録する
   */
  register(scopeId: string, options: ScopeOptions): void {
    this.#scopes.set(scopeId, options);
  }

  /**
   * スコープの登録を解除する
   */
  unregister(scopeId: string): void {
    this.#scopes.delete(scopeId);
    this.deactivate(scopeId);
  }

  /**
   * 特定のスコープをアクティブ（最前面）にする
   */
  activate(scopeId: string): void {
    const scope = this.#scopes.get(scopeId);
    if (!scope) return;

    if (scope.layer === "modal") {
      this.#modalStack = [
        ...this.#modalStack.filter((id) => id !== scopeId),
        scopeId,
      ];
    } else if (scope.layer === "view") {
      this.#viewStack = [
        ...this.#viewStack.filter((id) => id !== scopeId),
        scopeId,
      ];
    }
  }

  /**
   * 特定のスコープのアクティブ状態を解除する
   */
  deactivate(scopeId: string): void {
    this.#modalStack = this.#modalStack.filter((id) => id !== scopeId);
    this.#viewStack = this.#viewStack.filter((id) => id !== scopeId);
  }

  #handleKeyDown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!target) return;

    if (this.#isInputFieldBlocked(event, target)) {
      return;
    }

    const pressedKey = this.#normalizeKey(event);
    const physicalScopeId = target
      .closest("[data-shortcut-scope]")
      ?.getAttribute("data-shortcut-scope");
    const evaluationOrder = this.#determineEvaluationOrder(physicalScopeId);

    for (const scopeId of evaluationOrder) {
      const scope = this.#scopes.get(scopeId);
      if (!scope) continue;

      const matchedAction = scope.actions.find((a) =>
        this.#matchKey(a.key, pressedKey),
      );
      if (matchedAction) {
        const isHandled = matchedAction.action(event);
        if (isHandled !== false) {
          event.preventDefault();
          event.stopPropagation();
          break;
        }
      }
    }
  }

  #isInputFieldBlocked(event: KeyboardEvent, target: HTMLElement): boolean {
    const isInput =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target.isContentEditable;
    if (!isInput) return false;

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return false;
    }

    return (
      event.key.length === 1 ||
      event.key === "Backspace" ||
      event.key === "Delete"
    );
  }

  #determineEvaluationOrder(
    physicalScopeId: string | null | undefined,
  ): string[] {
    const order: string[] = [];

    for (let i = this.#modalStack.length - 1; i >= 0; i--) {
      order.push(this.#modalStack[i]!);
    }

    if (physicalScopeId && !order.includes(physicalScopeId)) {
      const scope = this.#scopes.get(physicalScopeId);
      if (scope && scope.layer === "view") {
        order.push(physicalScopeId);
      }
    }

    for (let i = this.#viewStack.length - 1; i >= 0; i--) {
      const id = this.#viewStack[i]!;
      if (!order.includes(id)) {
        order.push(id);
      }
    }

    for (const [id, scope] of this.#scopes.entries()) {
      if (scope.layer === "global" && !order.includes(id)) {
        order.push(id);
      }
    }

    return order;
  }

  #normalizeKey(event: KeyboardEvent): string {
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push("ctrl");
    if (event.metaKey) modifiers.push("meta");
    if (event.altKey) modifiers.push("alt");
    if (event.shiftKey) modifiers.push("shift");
    modifiers.push(event.key.toLowerCase());
    return modifiers.join("+");
  }

  #matchKey(actionKey: string, pressedKey: string): boolean {
    const normalizedActionKey = actionKey
      .toLowerCase()
      .replace("mod", this.#isMac ? "meta" : "ctrl");

    return normalizedActionKey === pressedKey;
  }
}

export const KEYBOARD_REGISTRY_KEY = Symbol("KEYBOARD_REGISTRY_KEY");
