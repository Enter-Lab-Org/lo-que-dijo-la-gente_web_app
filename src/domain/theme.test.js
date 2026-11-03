import { describe, it, expect } from "vitest";
import { normalizeTheme, resetTheme, themeFromBackup, setTitle, screenVars, applyProfileTheme } from "./theme";
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

  it("applies a game profile's title and colors, keeping images; reset goes back to the active profile's look", () => {
    const t = applyProfileTheme({ ...THEME0, rev: 4, page: "data:p", title: "Cliente" }, "tacones");
    expect(t).toEqual({ ...THEME0, rev: 4, page: "data:p", profile: "tacones", title: "100 Tacones Dijeron", gold: "#FFC727", rosa: "#FF4FA3", turq: "#1EC8B8" });
    expect(resetTheme(t)).toEqual({ ...THEME0, rev: 4, profile: "tacones", title: "100 Tacones Dijeron", gold: "#FFC727", rosa: "#FF4FA3", turq: "#1EC8B8" });
    expect(applyProfileTheme(t, "default")).toMatchObject({ profile: "default", title: "Lo que dijo la gente", gold: "#f5a518" });
  });

  it("adds the profile palette to the screen vars", () => {
    expect(screenVars({ profile: "tacones" })).toMatchObject({ "--bg": "#24093F", "--gold": "#f5a518" });
    expect(screenVars({ profile: "tacones" })["--marquee"]).toBe("#E8243C");
  });
});
