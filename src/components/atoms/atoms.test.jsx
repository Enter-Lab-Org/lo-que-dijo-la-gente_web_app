import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ArmedButton from "./ArmedButton";
import SyncedInput from "./SyncedInput";
import CommitInput from "./CommitInput";

describe("ArmedButton", () => {
  afterEach(() => vi.useRealTimers());

  it("needs a second click to run", async () => {
    const run = vi.fn(), user = userEvent.setup();
    render(<ArmedButton armedLabel="Toca otra vez para borrar" onConfirm={run}>Reiniciar marcador</ArmedButton>);
    const b = screen.getByRole("button");
    await user.click(b);
    expect(run).not.toHaveBeenCalled();
    expect(b).toHaveTextContent("Toca otra vez para borrar");
    expect(b).toHaveClass("btn", "armed");
    await user.click(b);
    expect(run).toHaveBeenCalledTimes(1);
    expect(b).toHaveTextContent("Reiniciar marcador");
    expect(b).not.toHaveClass("armed");
  });

  it("disarms after 3 seconds", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    render(<ArmedButton armedLabel="¿Eliminar?" onConfirm={run}>Eliminar</ArmedButton>);
    const b = screen.getByRole("button");
    fireEvent.click(b);
    act(() => { vi.advanceTimersByTime(3000); });
    expect(b).toHaveTextContent("Eliminar");
    fireEvent.click(b);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("SyncedInput", () => {
  it("reports typing and follows the value while not focused", async () => {
    const onInput = vi.fn(), user = userEvent.setup();
    const { rerender } = render(<SyncedInput aria-label="n" value="Uno" onInput={onInput} normalize={(v) => v.trim() || "X"} />);
    const inp = screen.getByLabelText("n");
    rerender(<SyncedInput aria-label="n" value="Dos" onInput={onInput} />);
    expect(inp).toHaveValue("Dos");
    await user.clear(inp);
    await user.type(inp, "Ab");
    expect(onInput).toHaveBeenLastCalledWith("Ab");
    rerender(<SyncedInput aria-label="n" value="Otro" onInput={onInput} normalize={(v) => v.trim() || "X"} />);
    expect(inp).toHaveValue("Ab");
    await user.clear(inp);
    await user.tab();
    expect(inp).toHaveValue("X");
  });
});

describe("CommitInput", () => {
  it("commits on change, not on every key", () => {
    const onCommit = vi.fn();
    render(<CommitInput aria-label="p" type="number" value={0} onCommit={onCommit} />);
    const inp = screen.getByLabelText("p");
    fireEvent.input(inp, { target: { value: "1" } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.change(inp, { target: { value: "15" } });
    expect(onCommit).toHaveBeenCalledWith("15");
  });
});
