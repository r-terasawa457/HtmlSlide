import { describe, it, expect, vi } from "vitest";
import { NavigationRegistry } from "../navigation.svelte";

describe("NavigationRegistry", () => {
  it("should manage and updates right actions reactively", () => {
    const registry = new NavigationRegistry();
    const mockAction = vi.fn();

    expect(registry.rightActions).toEqual([]);

    registry.rightActions = [
      { id: "test-btn", label: "保存", action: mockAction },
    ];

    expect(registry.rightActions).toHaveLength(1);

    const action = registry.rightActions[0]!;
    expect(action.label).toBe("保存");

    action.action();
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});
