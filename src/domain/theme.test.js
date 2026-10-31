import { describe, it, expect } from "vitest";
import { normalizeTheme, resetTheme, themeFromBackup, setTitle, screenVars } from "./theme";
import { THEME0 } from "./constants";

describe("theme", () => {
  it("fills defaults", () => {
    expect(normalizeTheme(null)).toEqual(THEME0);
    expect(normalizeTheme({ gold: "#000000" }).gold).toBe("#000000");
  });

  it("reset and backup keep the rev", () => {
    expect(resetTheme({ ...THEME0, rev: 7, title: "X", page: "data:x" })).toEqual({ ...THEME0, rev: 7 });
    expect(themeFromBackup({ rev: 3 }, { title: "Cliente", rev: 99 })).toEqual({ ...THEME0, title: "Cliente", rev: 3 });
  });

  it("empty title goes back to the default title", () => {
    expect(setTitle(THEME0, "  ").title).toBe("Lo que dijo la gente");
    expect(setTitle(THEME0, " Fiesta ").title).toBe("Fiesta");
  });

  it("builds CSS vars; shade applies only over images", () => {
    expect(screenVars(THEME0)).toEqual({
      "--gold": "#f5a518", "--rosa": "#e6007e", "--turq": "#18c2bd",
      "--page-img": "none", "--page-shade": "transparent", "--stage-img": "none", "--stage-shade": "transparent", "--tile-img": "none",
    });
    const v = screenVars({ page: "data:p", stage: "data:s", tile: "data:t", shade: 40 });
    expect(v["--page-img"]).toBe('url("data:p")');
    expect(v["--page-shade"]).toBe("rgba(11,24,48,0.4)");
    expect(v["--stage-shade"]).toBe("rgba(11,24,48,0.4)");
    expect(v["--tile-img"]).toBe('url("data:t")');
  });
});
