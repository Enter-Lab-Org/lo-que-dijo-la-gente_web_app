import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import PublicScreen from "./PublicScreen";
import Monitor from "./Monitor";
import { gameWith, pubOf, revealed, fakeAudio } from "../../test/fixtures";
import { strike, award, setMult, stamp } from "../../domain/game";

const tiles = (c) => [...c.querySelectorAll(".s-slot")];

describe("PublicScreen", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the waiting message and 8 blank tiles without questions", () => {
    const { container } = render(<PublicScreen pub={null} />);
    expect(screen.getByRole("heading", { name: "Esperando la primera pregunta" })).toBeInTheDocument();
    expect(container.querySelectorAll(".s-tile.pad")).toHaveLength(8);
    expect(screen.getByText("Lo que dijo la gente")).toBeInTheDocument();
  });

  it("shows scores, names, question, round and numbered tiles with blank padding", () => {
    const p = pubOf(gameWith("a", "b"));
    const { container } = render(<PublicScreen pub={p} />);
    expect(screen.getByText("Equipo Rosa")).toBeInTheDocument();
    expect(screen.getByText("Equipo Turquesa")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pregunta a" })).toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 2")).toBeInTheDocument();
    expect(tiles(container)).toHaveLength(3);
    expect(container.querySelectorAll(".s-tile.pad")).toHaveLength(1);
    expect(container.querySelector(".s-board").style.getPropertyValue("--rows")).toBe("2");
    expect(container.querySelectorAll(".s-num")[2]).toHaveTextContent("3");
  });

  it("flips revealed tiles and shows text and points", () => {
    const p = pubOf(revealed(gameWith("a"), 1));
    const { container } = render(<PublicScreen pub={p} />);
    const t = tiles(container);
    expect(t[1]).toHaveClass("open");
    expect(t[1]).toHaveTextContent("Cerveza25");
    expect(t[0]).not.toHaveClass("open");
    expect(screen.getByTestId("pot")).toHaveTextContent("25");
  });

  it("security: hidden answers never reach the DOM, also after hiding again", () => {
    let s = revealed(gameWith("a"), 0);
    const { container, rerender } = render(<PublicScreen pub={pubOf(s)} />);
    expect(container).toHaveTextContent("Tortillas");
    expect(container).not.toHaveTextContent("Cerveza");
    expect(container).not.toHaveTextContent("Salsa");
    s = revealed(s, 0);
    rerender(<PublicScreen pub={{ ...pubOf(s), rev: 2 }} />);
    expect(container).not.toHaveTextContent("Tortillas");
  });

  it("shows strikes, steal status and multiplier", () => {
    let s = gameWith("a");
    s = strike(strike(strike(s).state).state).state;
    s = setMult(s, 2).state;
    const { container } = render(<PublicScreen pub={pubOf(s)} />);
    expect(container.querySelectorAll(".s-strike.on")).toHaveLength(3);
    expect(screen.getByText("Tres strikes: el otro equipo puede robar")).toBeInTheDocument();
    expect(screen.getByText("Pregunta 1 de 1 · Puntos dobles")).toBeInTheDocument();
  });

  it("shows who won the round", () => {
    const s = award(revealed(gameWith("a"), 0), "B").state;
    render(<PublicScreen pub={pubOf(s)} />);
    expect(screen.getByText("Ronda para Equipo Turquesa")).toBeInTheDocument();
    expect(screen.getByTestId("team-b")).toHaveTextContent("34");
  });

  it("applies the theme: colors, images, title and logo", () => {
    const theme = { title: "Fiesta UdeG", gold: "#111111", tile: "data:t", logo: "data:logo", shade: 50 };
    const { container } = render(<PublicScreen pub={null} theme={theme} />);
    const wrap = container.querySelector(".scrwrap");
    expect(wrap).toHaveClass("has-tile-img");
    expect(wrap.style.getPropertyValue("--gold")).toBe("#111111");
    expect(screen.getByText("Fiesta UdeG")).toBeInTheDocument();
    expect(container.querySelector(".s-logo")).toHaveAttribute("src", "data:logo");
    expect(container.querySelector(".s-logo")).toBeVisible();
  });

  it("hides the logo when there is none", () => {
    const { container } = render(<PublicScreen pub={null} />);
    expect(container.querySelector(".s-logo")).not.toBeVisible();
    expect(container.querySelector(".s-logo")).not.toHaveAttribute("src");
  });

  it("plays a recent buzz: big X for about a second and sound", () => {
    vi.useFakeTimers();
    const audio = fakeAudio();
    let s = gameWith("a");
    const { rerender } = render(<PublicScreen pub={pubOf(s)} audio={audio} />);
    s = stamp(strike(strike(s).state).state, "buzz", { now: Date.now() });
    rerender(<PublicScreen pub={pubOf(s)} audio={audio} />);
    expect(screen.getByTestId("bigx").querySelectorAll("span")).toHaveLength(2);
    expect(screen.getByTestId("bigx")).toBeVisible();
    expect(audio.play).toHaveBeenCalledWith("buzz");
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.getByTestId("bigx")).not.toBeVisible();
  });

  it("does not repeat an fx, ignores old fx and respects sound off", () => {
    const audio = fakeAudio();
    const old = { ...pubOf(gameWith("a")), fx: { id: "f1", type: "ding", n: 0, at: Date.now() - 9000 } };
    const { rerender } = render(<PublicScreen pub={old} audio={audio} />);
    expect(audio.play).not.toHaveBeenCalled();
    const fresh = { ...old, rev: 2, fx: { id: "f2", type: "win", n: 0, at: Date.now() } };
    rerender(<PublicScreen pub={fresh} audio={audio} />);
    rerender(<PublicScreen pub={{ ...fresh, rev: 3 }} audio={audio} />);
    expect(audio.play).toHaveBeenCalledTimes(1);
    rerender(<PublicScreen pub={{ ...fresh, rev: 4, sound: false, fx: { id: "f3", type: "ding", at: Date.now() } }} audio={audio} />);
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("bumps the score when it changes", () => {
    const s = revealed(gameWith("a"), 0);
    const { rerender } = render(<PublicScreen pub={pubOf(s)} />);
    rerender(<PublicScreen pub={pubOf(award(s, "A").state)} />);
    expect(screen.getByTestId("team-a").querySelector(".s-score")).toHaveClass("bump");
  });
});

describe("Monitor", () => {
  it("renders a silent preview of the public screen", () => {
    const { container } = render(<Monitor id="mon1" pub={pubOf(gameWith("a"))} />);
    expect(container.querySelector("#mon1.monitor .scrwrap.preview")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pregunta a" })).toBeInTheDocument();
  });

  it("scales to its width over a 1280px base", () => {
    const spy = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(640);
    const { container } = render(<Monitor pub={null} />);
    expect(container.querySelector(".scrwrap").style.transform).toBe("scale(0.5)");
    spy.mockRestore();
  });
});
