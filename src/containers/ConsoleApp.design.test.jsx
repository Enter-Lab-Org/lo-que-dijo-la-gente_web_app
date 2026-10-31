import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, storageWithGame, question } from "../test/fixtures";

const lastTheme = (bus) => [...bus.posted].reverse().find((m) => m.kind === "theme").theme;
function setup(over = {}) {
  const services = fakeServices({ storage: storageWithGame([question("a")], { "ldlg-tab": "diseno" }), ...over });
  const user = userEvent.setup();
  render(<App services={services} />);
  return { services, user, bus: services.bus, storage: services.storage };
}
const preview = () => document.getElementById("mon2");
const png = () => new File(["x"], "logo.png", { type: "image/png" });

describe("Design tab", () => {
  afterEach(() => vi.useRealTimers());

  it("shows a live preview of the public screen with the current question", () => {
    setup();
    expect(within(preview()).getByRole("heading", { name: "Pregunta a" })).toBeInTheDocument();
  });

  it("uploads and shrinks images per slot, shows a thumbnail and applies them", async () => {
    const { user, services, bus, storage } = setup();
    await user.upload(screen.getByLabelText("Subir Logo"), png());
    expect(services.images.prepImage).toHaveBeenCalledWith(expect.any(File), 600, true);
    expect(await screen.findByText("Imagen aplicada.")).toBeInTheDocument();
    expect(screen.getByTestId("thumb-logo")).toHaveClass("filled");
    expect(lastTheme(bus).logo).toBe("data:image/jpeg;base64,AAA");
    expect(storage.data.get("ldlg-theme-v2").logo).toBe("data:image/jpeg;base64,AAA");
    expect(preview().querySelector(".s-logo")).toHaveAttribute("src", "data:image/jpeg;base64,AAA");
    await user.upload(screen.getByLabelText("Subir Fondo de la pantalla"), png());
    expect(services.images.prepImage).toHaveBeenLastCalledWith(expect.any(File), 1920, false);
    await user.upload(screen.getByLabelText("Subir Fondo del tablero"), png());
    expect(services.images.prepImage).toHaveBeenLastCalledWith(expect.any(File), 1600, false);
    await user.upload(screen.getByLabelText("Subir Fichas ocultas"), png());
    expect(services.images.prepImage).toHaveBeenLastCalledWith(expect.any(File), 900, false);
    expect(preview().querySelector(".scrwrap")).toHaveClass("has-tile-img");
  });

  it("shows a clear error for files that are not images", async () => {
    const images = { prepImage: vi.fn(async () => { throw new Error("bad"); }) };
    const { user } = setup({ images });
    await user.upload(screen.getByLabelText("Subir Fondo de la pantalla"), png());
    expect(await screen.findByText("No pude abrir ese archivo. Usa una imagen JPG, PNG o WebP.")).toBeInTheDocument();
  });

  it("warns when images are too heavy to save", async () => {
    const { user, storage } = setup();
    storage.set.mockImplementation((k) => k !== "ldlg-theme-v2");
    await user.upload(screen.getByLabelText("Subir Logo"), png());
    expect(await screen.findByText("Las imágenes pesan demasiado para guardarse aquí. Prueba con imágenes más ligeras.")).toBeInTheDocument();
  });

  it("removes an image", async () => {
    const { user, bus } = setup();
    await user.upload(screen.getByLabelText("Subir Logo"), png());
    await screen.findByText("Imagen aplicada.");
    await user.click(screen.getByRole("button", { name: "Quitar Logo" }));
    expect(screen.getByText("Imagen quitada.")).toBeInTheDocument();
    expect(lastTheme(bus).logo).toBeNull();
    expect(screen.getByTestId("thumb-logo")).not.toHaveClass("filled");
  });

  it("changes title (falls back when empty), colors and shade live", () => {
    vi.useFakeTimers();
    const { bus } = setup();
    fireEvent.change(document.getElementById("t-title"), { target: { value: "Fiesta Enterlab" } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(lastTheme(bus).title).toBe("Fiesta Enterlab");
    expect(within(preview()).getByText("Fiesta Enterlab")).toBeInTheDocument();
    fireEvent.change(document.getElementById("t-title"), { target: { value: "" } });
    act(() => { vi.advanceTimersByTime(300); });
    expect(lastTheme(bus).title).toBe("Lo que dijo la gente");
    fireEvent.input(document.getElementById("t-gold"), { target: { value: "#123456" } });
    expect(lastTheme(bus).gold).toBe("#123456");
    expect(preview().querySelector(".scrwrap").style.getPropertyValue("--gold")).toBe("#123456");
    fireEvent.change(document.getElementById("t-shade"), { target: { value: "30" } });
    expect(lastTheme(bus).shade).toBe(30);
  });

  it("restores the original design after a second click", async () => {
    const { user, bus } = setup();
    fireEvent.input(document.getElementById("t-rosa"), { target: { value: "#000000" } });
    await user.click(screen.getByRole("button", { name: "Volver al diseño original" }));
    expect(lastTheme(bus).rosa).toBe("#000000");
    await user.click(screen.getByRole("button", { name: "Toca otra vez para restaurar" }));
    expect(lastTheme(bus)).toMatchObject({ rosa: "#e6007e", title: "Lo que dijo la gente", logo: null });
    expect(screen.getByText("Diseño original restaurado.")).toBeInTheDocument();
  });

  it("every theme change increases rev", () => {
    const { bus } = setup();
    fireEvent.input(document.getElementById("t-turq"), { target: { value: "#000001" } });
    const r1 = lastTheme(bus).rev;
    fireEvent.input(document.getElementById("t-turq"), { target: { value: "#000002" } });
    expect(lastTheme(bus).rev).toBeGreaterThan(r1);
  });
});
