import { describe, it, expect, vi, beforeEach } from "vitest";
import { KeyboardEventRegistry } from "../keyboardEventRegistry.svelte";

describe("KeyboardEventRegistry", () => {
  let registry: KeyboardEventRegistry;

  beforeEach(() => {
    registry = new KeyboardEventRegistry();
  });

  it("should bubble virtual events in stack order and stop when handled", () => {
    const viewAction = vi.fn().mockReturnValue(true);
    const globalAction = vi.fn().mockReturnValue(true);

    registry.register("global-scope", {
      layer: "global",
      actions: [{ key: "mod+s", action: globalAction }],
    });

    registry.register("view-scope", {
      layer: "view",
      actions: [{ key: "mod+s", action: viewAction }],
    });

    registry.activate("view-scope");

    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.body.dispatchEvent(event);

    expect(viewAction).toHaveBeenCalledTimes(1);
    expect(globalAction).not.toHaveBeenCalled();
  });

  it("should fall back to lower priority layer if higher layer returns false", () => {
    const viewAction = vi.fn().mockReturnValue(false);
    const globalAction = vi.fn().mockReturnValue(true);

    registry.register("global-scope", {
      layer: "global",
      actions: [{ key: "ctrl+s", action: globalAction }],
    });

    registry.register("view-scope", {
      layer: "view",
      actions: [{ key: "ctrl+s", action: viewAction }],
    });

    registry.activate("view-scope");

    const event = new KeyboardEvent("keydown", {
      key: "s",
      ctrlKey: true,
      bubbles: true,
    });

    document.body.dispatchEvent(event);

    expect(viewAction).toHaveBeenCalledTimes(1);
    expect(globalAction).toHaveBeenCalledTimes(1);
  });
});
