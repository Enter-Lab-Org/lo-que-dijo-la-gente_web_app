import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../GameApp";
import { fakeServices, storageWithGame, question } from "../test/fixtures";

const win = (hash = "") => ({ location: { hash }, addEventListener() {}, removeEventListener() {} });
const tabNames = () => screen.queryAllByRole("tab").map((t) => t.textContent);
// Restricted table injected for the tests: the real ACCESS grants everything for now.
const access = { ADMIN: ["juego", "banco", "diseno", "publico"], OPERADOR: ["juego"], GUEST: [] };

describe("Console · roles", () => {
  it("shows every section and the role to a user whose role allows all (current real table)", () => {
    render(<App services={fakeServices({ storage: storageWithGame([question("a")]) })} user={{ email: "g@x.co", role: "GUEST" }} onLogout={() => {}} />);
    expect(tabNames()).toEqual(["Juego", "Banco de preguntas", "Diseño"]);
    expect(screen.getByText("GUEST")).toBeInTheDocument();
  });

  it("only renders the tabs and panels the role may access", () => {
    render(<App services={fakeServices({ storage: storageWithGame([question("a")]) })} access={access} user={{ email: "op@x.co", role: "OPERADOR" }} onLogout={() => {}} />);
    expect(tabNames()).toEqual(["Juego"]);
    expect(document.getElementById("p-juego")).not.toBeNull();
    expect(document.getElementById("p-banco")).toBeNull();
    expect(document.getElementById("p-diseno")).toBeNull();
  });

  it("opens an allowed section when the saved tab is not allowed, and ignores links to blocked ones", async () => {
    const storage = storageWithGame([], { "ldlg-tab": "banco" });
    render(<App services={fakeServices({ storage })} access={access} user={{ email: "op@x.co", role: "OPERADOR" }} onLogout={() => {}} />);
    expect(screen.getByRole("tab", { name: "Juego" })).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("p-juego").hidden).toBe(false);
    await userEvent.setup().click(screen.getAllByRole("button", { name: "Banco de preguntas" })[0]);
    expect(document.getElementById("p-juego").hidden).toBe(false);
    expect(storage.get("ldlg-tab")).toBe("banco");
  });

  it("shows a no-access message, with logout, when the role has no console section", () => {
    render(<App services={fakeServices({ storage: storageWithGame([question("a")]) })} access={access} user={{ email: "g@x.co", role: "GUEST" }} onLogout={() => {}} />);
    expect(tabNames()).toEqual([]);
    expect(screen.getByText("Tu usuario no tiene acceso a esta sección.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });

  it("blocks the public screen for a role without it", () => {
    render(<App services={fakeServices()} win={win("#publico")} access={access} user={{ email: "op@x.co", role: "OPERADOR" }} />);
    expect(screen.getByText("Tu usuario no tiene acceso a esta sección.")).toBeInTheDocument();
    expect(document.getElementById("pub")).toBeNull();
  });

  it("keeps the public screen for a role with it, and for the desktop app (no user)", () => {
    const { unmount } = render(<App services={fakeServices()} win={win("#publico")} access={access} user={{ email: "a@x.co", role: "ADMIN" }} />);
    expect(document.getElementById("pub")).not.toBeNull();
    unmount();
    render(<App services={fakeServices()} win={win("#publico")} access={access} />);
    expect(document.getElementById("pub")).not.toBeNull();
  });
});
