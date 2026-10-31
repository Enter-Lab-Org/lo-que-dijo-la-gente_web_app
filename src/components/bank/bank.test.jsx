import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BankToolbar from "./BankToolbar";
import BankList from "./BankList";
import BankItem from "./BankItem";
import QuestionForm from "./QuestionForm";
import ImportPanel from "./ImportPanel";
import BackupPanel from "./BackupPanel";
import { blankAnswers } from "../../domain/bank";
import { question } from "../../test/fixtures";

describe("BankToolbar", () => {
  it("reports search, category and new", async () => {
    const p = { onQuery: vi.fn(), onCat: vi.fn(), onNew: vi.fn() };
    render(<BankToolbar query="" cat="" options={[{ value: "", label: "Todas las categorías" }, { value: "X", label: "X" }]} {...p} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar" }), "a");
    expect(p.onQuery).toHaveBeenCalledWith("a");
    await userEvent.selectOptions(screen.getByRole("combobox"), "X");
    expect(p.onCat).toHaveBeenCalledWith("X");
    await userEvent.click(screen.getByRole("button", { name: "Nueva" }));
    expect(p.onNew).toHaveBeenCalled();
  });
});

describe("BankItem / BankList", () => {
  it("singular answer count and toggle label", async () => {
    const onToggleGame = vi.fn();
    render(<ul><BankItem item={question("a", [["Uno", 7]])} inGame={false} onToggleGame={onToggleGame} onEdit={vi.fn()} onDelete={vi.fn()} /></ul>);
    expect(screen.getByText("1 respuesta · 7 pts")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Agregar a la partida" }));
    expect(onToggleGame).toHaveBeenCalled();
  });

  it("delete is armed", async () => {
    const onDelete = vi.fn(), user = userEvent.setup();
    render(<ul><BankItem item={question("a")} inGame onToggleGame={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} /></ul>);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(screen.getByRole("button", { name: "¿Eliminar?" }));
    expect(onDelete).toHaveBeenCalledWith("a");
  });

  it("count, notice and singular", () => {
    const { rerender } = render(<BankList items={[question("a")]} total={1} notice={null} isInGame={() => true} onAddAll={vi.fn()} onToggleGame={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("1 de 1 pregunta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar las que se ven a la partida" })).toBeDisabled();
    rerender(<BankList items={[]} total={1} notice="Ya estaban en la partida" isInGame={() => true} onAddAll={vi.fn()} onToggleGame={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText("Ya estaban en la partida")).toBeInTheDocument();
  });
});

describe("QuestionForm", () => {
  const props = () => ({ categories: [], message: "", onChange: vi.fn(), onAnswer: vi.fn(), onAddAnswer: vi.fn(), onRemoveAnswer: vi.fn(), onClear: vi.fn(), onSubmit: vi.fn() });

  it("renders the new form with 5 blank rows and submits", async () => {
    const p = props();
    render(<QuestionForm form={{ id: null, q: "", cat: "", answers: blankAnswers() }} {...p} />);
    expect(screen.getByRole("heading", { name: "Nueva pregunta" })).toBeInTheDocument();
    expect(screen.getAllByRole("textbox", { name: /^Respuesta/ })).toHaveLength(5);
    await userEvent.type(screen.getByRole("textbox", { name: "Respuesta 2" }), "x");
    expect(p.onAnswer).toHaveBeenCalledWith(1, "text", "x");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(p.onSubmit).toHaveBeenCalled();
  });

  it("edit mode title, totals and message", () => {
    render(<QuestionForm form={{ id: "a", q: "Q", cat: "", answers: [{ text: "A", pts: 3 }] }} {...props()} message="Cambios guardados." />);
    expect(screen.getByRole("heading", { name: "Editar pregunta" })).toBeInTheDocument();
    expect(screen.getByText("1 respuesta · 3 pts")).toBeInTheDocument();
    expect(screen.getByText("Cambios guardados.")).toBeInTheDocument();
  });
});

describe("ImportPanel / BackupPanel", () => {
  it("import actions", async () => {
    const p = { onText: vi.fn(), onCat: vi.fn(), onImport: vi.fn(), onOpenFile: vi.fn() };
    render(<ImportPanel text="" cat="" message="Listo" {...p} />);
    expect(screen.getByText(/Tortillas \| 34/)).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Preguntas para importar" }), "Q");
    expect(p.onText).toHaveBeenCalledWith("Q");
    await userEvent.click(screen.getByRole("button", { name: "Importar al banco" }));
    await userEvent.click(screen.getByRole("button", { name: "Abrir archivo" }));
    expect(p.onImport).toHaveBeenCalled();
    expect(p.onOpenFile).toHaveBeenCalled();
  });

  it("backup actions", async () => {
    const p = { onBackup: vi.fn(), onExportText: vi.fn() };
    render(<BackupPanel message="" {...p} />);
    await userEvent.click(screen.getByRole("button", { name: "Guardar respaldo" }));
    await userEvent.click(screen.getByRole("button", { name: "Exportar preguntas en texto" }));
    expect(p.onBackup).toHaveBeenCalled();
    expect(p.onExportText).toHaveBeenCalled();
  });
});
