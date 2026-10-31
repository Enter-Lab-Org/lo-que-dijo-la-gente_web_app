import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StartOverlay from "./StartOverlay";
import CornerControls from "./CornerControls";

describe("public controls", () => {
  it("start overlay", async () => {
    const onStart = vi.fn();
    render(<StartOverlay onStart={onStart} />);
    expect(screen.getByText("Pantalla lista")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Iniciar" }));
    expect(onStart).toHaveBeenCalled();
  });

  it("corner fullscreen button", async () => {
    const onFullscreen = vi.fn();
    const { rerender } = render(<CornerControls show={false} onFullscreen={onFullscreen} />);
    expect(screen.getByTestId("corner")).not.toHaveClass("show");
    rerender(<CornerControls show onFullscreen={onFullscreen} />);
    expect(screen.getByTestId("corner")).toHaveClass("show");
    await userEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
    expect(onFullscreen).toHaveBeenCalled();
  });
});
