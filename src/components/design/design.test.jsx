import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DesignPanel from "./DesignPanel";
import ImageSlot from "./ImageSlot";
import { THEME0 } from "../../domain/constants";

describe("ImageSlot", () => {
  it("shows empty and filled thumbnails and reports file and clear", async () => {
    const onFile = vi.fn(), onClear = vi.fn();
    const { rerender } = render(<ImageSlot slot="logo" title="Logo" emptyText="Sin logo" logo image={null} onFile={onFile} onClear={onClear} />);
    expect(screen.getByTestId("thumb-logo")).toHaveTextContent("Sin logo");
    expect(screen.getByTestId("thumb-logo")).toHaveClass("logo-thumb");
    const file = new File(["x"], "a.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Subir Logo"), file);
    expect(onFile).toHaveBeenCalledWith("logo", file);
    await userEvent.click(screen.getByRole("button", { name: "Quitar Logo" }));
    expect(onClear).toHaveBeenCalledWith("logo");
    rerender(<ImageSlot slot="logo" title="Logo" image="data:x" onFile={onFile} onClear={onClear} />);
    expect(screen.getByTestId("thumb-logo")).toHaveClass("filled");
    expect(screen.getByTestId("thumb-logo").style.backgroundImage).toContain("data:x");
  });
});

describe("DesignPanel", () => {
  it("renders the 4 slots and fields from the theme", async () => {
    const p = { onFile: vi.fn(), onClear: vi.fn(), onTitle: vi.fn(), onColor: vi.fn(), onShade: vi.fn(), onReset: vi.fn() };
    render(<DesignPanel theme={THEME0} message="" {...p} />);
    ["Fondo de la pantalla", "Fondo del tablero", "Fichas ocultas", "Logo"].forEach((t) => expect(screen.getByRole("heading", { name: t })).toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Título del juego" })).toHaveValue("Lo que dijo la gente");
    expect(screen.getByRole("textbox", { name: "Título del juego" })).toHaveAttribute("maxlength", "40");
    expect(screen.getByLabelText("Color de acento")).toHaveValue("#f5a518");
    expect(screen.getByRole("slider", { name: "Oscurecer fondos" })).toHaveValue("55");
    await userEvent.type(screen.getByRole("textbox", { name: "Título del juego" }), "!");
    expect(p.onTitle).toHaveBeenCalledWith("Lo que dijo la gente!");
  });
});
