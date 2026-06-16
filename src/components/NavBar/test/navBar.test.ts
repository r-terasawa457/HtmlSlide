import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Navbar from "../Navbar.svelte";
import { NavigationRegistry, NAVIGATION_KEY } from "../navigation.svelte";

describe("Navbar Component", () => {
  it("should render actions from registry and handles clicks", async () => {
    const user = userEvent.setup();
    const registry = new NavigationRegistry();
    const mockSave = vi.fn();

    registry.rightActions = [
      {
        id: "save",
        label: "変更を保存",
        variant: "primary",
        disabled: false,
        action: mockSave,
      },
      { id: "cancel", label: "破棄", disabled: true, action: () => {} },
    ];

    render(Navbar, {
      context: new Map([[NAVIGATION_KEY, registry]]),
    });

    const saveButton = screen.getByRole("button", { name: "変更を保存" });
    const cancelButton = screen.getByRole("button", { name: "破棄" });

    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
    expect(cancelButton).toBeDisabled();
    expect(saveButton).toHaveClass("bg-blue-600");

    await user.click(saveButton);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
