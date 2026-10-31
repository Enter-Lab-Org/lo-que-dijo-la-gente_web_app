import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConsoleHeader from "./ConsoleHeader";
import HostPanel from "./HostPanel";
import AnswerList from "./AnswerList";
import StrikeControls from "./StrikeControls";
import PotPanel from "./PotPanel";
import MultiplierSelector from "./MultiplierSelector";
import TeamsPanel from "./TeamsPanel";
import Playlist from "./Playlist";
import KeyboardHint from "./KeyboardHint";
import { NativeProjectorPanel, WebProjectorPanel } from "./ProjectorPanel";
import { question } from "../../test/fixtures";

const fnActions = () => ({ toggleReveal: vi.fn(), strike: vi.fn(), setStrikes: vi.fn(), award: vi.fn(), revealAll: vi.fn(), go: vi.fn(), setMult: vi.fn() });
const open = { revealed: [], free: [], strikes: 0, awardedTo: null };

describe("ConsoleHeader / Tabs", () => {
  it("renders the three tabs and reports clicks", async () => {
    const onTab = vi.fn();
    render(<ConsoleHeader tab="banco" onTab={onTab} native={false} />);
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Juego", "Banco de preguntas", "Diseño"]);
    expect(screen.getByRole("tab", { name: "Banco de preguntas" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Diseño" }));
    expect(onTab).toHaveBeenCalledWith("diseno");
    expect(screen.getByText("Guardado en este navegador")).toBeInTheDocument();
  });
});

describe("HostPanel", () => {
  it("shows question, category, round state and controls", async () => {
    const actions = fnActions(), user = userEvent.setup();
    render(<HostPanel item={question("a", [["Uno", 10]], "Cliente")} idx={0} total={2} round={open} roundState={{ text: "Ronda abierta", tone: "" }}
      pot={0} nameA="Rojos" nameB="Azules" mult={1} actions={actions} onGoto={vi.fn()} />);
    expect(screen.getByText("Pregunta 1 de 2 · Cliente")).toBeInTheDocument();
    expect(screen.getByText("Ronda abierta")).toHaveClass("pill");
    expect(screen.getByRole("button", { name: "Puntos para Rojos" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "← Anterior" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Siguiente →" }));
    expect(actions.go).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole("button", { name: "Mostrar todas" }));
    expect(actions.revealAll).toHaveBeenCalled();
  });

  it("shows the empty state with a link to the bank", async () => {
    const onGoto = vi.fn();
    render(<HostPanel item={null} idx={0} total={0} round={null} roundState={{ text: "Sin ronda", tone: "" }} pot={0} nameA="A" nameB="B" mult={1} actions={fnActions()} onGoto={onGoto} />);
    expect(screen.getByRole("heading", { name: "La partida está vacía" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "X Strike" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Strike 1" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Banco de preguntas" }));
    expect(onGoto).toHaveBeenCalledWith("banco");
  });
});

describe("AnswerList", () => {
  it("marks revealed and free answers", async () => {
    const onToggle = vi.fn();
    render(<AnswerList answers={question("a").answers} revealed={[0, 2]} free={[2]} onToggle={onToggle} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveClass("open");
    expect(items[1]).not.toHaveClass("open");
    expect(items[2]).toHaveClass("open", "free");
    await userEvent.click(screen.getByRole("button", { name: "Revelar respuesta 2" }));
    expect(onToggle).toHaveBeenCalledWith(1);
  });
});

describe("StrikeControls, PotPanel, MultiplierSelector", () => {
  it("strike buttons", async () => {
    const onStrike = vi.fn(), onSet = vi.fn();
    render(<StrikeControls strikes={2} disabled={false} onStrike={onStrike} onSet={onSet} />);
    expect(screen.getByRole("button", { name: "Strike 2" })).toHaveClass("on");
    expect(screen.getByRole("button", { name: "Strike 3" })).not.toHaveClass("on");
    await userEvent.click(screen.getByRole("button", { name: "Strike 3" }));
    expect(onSet).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByRole("button", { name: "X Strike" }));
    expect(onStrike).toHaveBeenCalled();
  });

  it("pot and award", async () => {
    const onAward = vi.fn();
    render(<PotPanel pot={45} nameA="Rojos" nameB="Azules" disabled={false} onAward={onAward} />);
    expect(screen.getByText("45")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Puntos para Azules" }));
    expect(onAward).toHaveBeenCalledWith("B");
  });

  it("multiplier", async () => {
    const onChange = vi.fn();
    render(<MultiplierSelector mult={3} onChange={onChange} />);
    expect(screen.getByRole("button", { name: "x3" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "x1" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "x2" }));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe("TeamsPanel", () => {
  it("edits names and scores and toggles sound", async () => {
    const p = { onName: vi.fn(), onScore: vi.fn(), onToggleSound: vi.fn(), onReset: vi.fn() };
    const user = userEvent.setup();
    render(<TeamsPanel nameA="Equipo Rosa" nameB="Equipo Turquesa" scoreA={10} scoreB={0} sound={false} {...p} />);
    expect(screen.getByRole("textbox", { name: "Equipo 1" })).toHaveValue("Equipo Rosa");
    expect(screen.getAllByRole("spinbutton", { name: "Puntos" })[0]).toHaveValue(10);
    await user.type(screen.getByRole("textbox", { name: "Equipo 2" }), "!");
    expect(p.onName).toHaveBeenLastCalledWith("B", "Equipo Turquesa!");
    await user.click(screen.getByRole("button", { name: "Sonido en pantalla: no" }));
    expect(p.onToggleSound).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Equipo 1" })).toHaveAttribute("maxlength", "24");
  });
});

describe("Playlist", () => {
  it("renders items with current and done marks and wires actions", async () => {
    const p = { onGo: vi.fn(), onMove: vi.fn(), onRemove: vi.fn(), onClear: vi.fn(), onGoto: vi.fn() };
    const user = userEvent.setup();
    render(<Playlist list={[question("a"), question("b")]} idx={1} rounds={{ a: { awardedTo: "A" } }} {...p} />);
    const items = within(document.getElementById("playlist")).getAllByRole("listitem");
    expect(items[0]).toHaveClass("done");
    expect(items[1]).toHaveClass("cur");
    expect(screen.getByText("· 2")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Bajar" })[0]);
    expect(p.onMove).toHaveBeenCalledWith(0, 1);
    await user.click(screen.getAllByRole("button", { name: "Quitar de la partida" })[1]);
    expect(p.onRemove).toHaveBeenCalledWith("b");
    await user.click(screen.getByRole("button", { name: /Pregunta a/ }));
    expect(p.onGo).toHaveBeenCalledWith(0);
    expect(document.getElementById("plEmpty")).not.toBeVisible();
  });
});

describe("KeyboardHint", () => {
  it("lists the shortcuts", () => {
    render(<KeyboardHint />);
    expect(screen.getByText(/revelan/)).toHaveTextContent("Teclado: 1–8 revelan · X strike · A / B dan los puntos · ← → cambian de pregunta.");
  });
});

describe("ProjectorPanel", () => {
  it("web: opens the public screen", async () => {
    const onOpen = vi.fn();
    render(<WebProjectorPanel blocked={false} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Abrir pantalla del público" }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("native: shows searching until displays arrive", () => {
    render(<NativeProjectorPanel info={null} status="" selected="" onSelect={vi.fn()} onPlace={vi.fn()} onWindowed={vi.fn()} onToggle={vi.fn()} />);
    expect(screen.getByText("Buscando pantallas…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocultar" })).toBeInTheDocument();
  });
});
