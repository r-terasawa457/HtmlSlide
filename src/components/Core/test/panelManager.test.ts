import { describe, it, expect } from "vitest";
import { PanelManager } from "../panelManager.svelte";
import type { Component } from "svelte";

/** テスト用のモックコンポーネントオブジェクト */
const MockComponent = {} as Component<any>;

describe("PanelManager", () => {
  it("should initialize with an empty panels array", () => {
    const manager = new PanelManager();
    expect(manager.panels).toEqual([]);
  });

  it("should register a new panel and prevent duplicate registrations", () => {
    const manager = new PanelManager();
    const panel = {
      id: "outline",
      title: "OUTLINE",
      component: MockComponent,
      isOpen: true,
      width: 250,
    };

    manager.register(panel);
    expect(manager.panels).toHaveLength(1);
    expect(manager.panels[0]).toEqual(panel);

    manager.register({ ...panel, title: "DUPLICATE" });
    expect(manager.panels).toHaveLength(1);
    expect(manager.panels[0]!.title).toBe("OUTLINE");
  });

  it("should unregister a panel and completely remove its reference from the array", () => {
    const manager = new PanelManager();
    manager.register({
      id: "outline",
      title: "OUTLINE",
      component: MockComponent,
      isOpen: true,
      width: 250,
    });
    manager.register({
      id: "preview",
      title: "PREVIEW",
      component: MockComponent,
      isOpen: true,
      width: 600,
    });

    manager.unregister("outline");
    expect(manager.panels).toHaveLength(1);
    expect(manager.panels.some((p) => p.id === "outline")).toBe(false);
    expect(manager.panels[0]!.id).toBe("preview");
  });

  it("should toggle the isOpen state of a specific panel", () => {
    const manager = new PanelManager();
    manager.register({
      id: "outline",
      title: "OUTLINE",
      component: MockComponent,
      isOpen: true,
      width: 250,
    });

    manager.togglePanel("outline");
    expect(manager.panels[0]!.isOpen).toBe(false);

    manager.togglePanel("outline");
    expect(manager.panels[0]!.isOpen).toBe(true);
  });

  it("should update panel width and enforce a minimum threshold of 100px", () => {
    const manager = new PanelManager();
    manager.register({
      id: "outline",
      title: "OUTLINE",
      component: MockComponent,
      isOpen: true,
      width: 250,
    });

    manager.updateWidth("outline", 400);
    expect(manager.panels[0]!.width).toBe(400);

    manager.updateWidth("outline", 50);
    expect(manager.panels[0]!.width).toBe(100);
  });
});
