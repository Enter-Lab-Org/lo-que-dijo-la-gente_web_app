import { describe, it, expect } from "vitest";
import { PROFILES, PROFILE_LIST, QUESTION_PROFILE_LIST, getProfile, profileVars, normalizeProfileConfig, pickedQuestions, toBankItem } from "./profiles";

describe("game profiles", () => {
  it("has the default and 100 Tacones Dijeron profiles, each tied to a question profile", () => {
    expect(PROFILE_LIST.map((p) => [p.id, p.name, p.questionProfile])).toEqual([
      ["default", "Lo que dijo la gente", "DEFAULT"],
      ["tacones", "100 Tacones Dijeron", "ADULT"],
    ]);
    expect(QUESTION_PROFILE_LIST).toEqual(["DEFAULT", "ADULT"]);
    PROFILE_LIST.forEach((p) => expect(QUESTION_PROFILE_LIST).toContain(p.questionProfile));
  });

  it("uses the presentation palette for 100 Tacones Dijeron and none for default; unknown ids fall back to default", () => {
    expect(PROFILES.tacones.theme).toEqual({ title: "100 Tacones Dijeron", gold: "#FFC727", rosa: "#FF4FA3", turq: "#1EC8B8" });
    expect(profileVars("tacones")).toMatchObject({ "--bg": "#24093F", "--tile": "#4B1580", "--tile-hi": "#7A2DC8", "--x": "#E8243C", "--orange": "#FF7A1A", "--paper": "#FFF3DC" });
    expect(profileVars("default")).toEqual({});
    expect(getProfile("nope").id).toBe("default");
  });

  it("normalizes the stored config to a known active profile (the picks live in the database)", () => {
    expect(normalizeProfileConfig(null)).toEqual({ active: "default" });
    expect(normalizeProfileConfig({ active: "x", selected: { tacones: [3] } })).toEqual({ active: "default" });
    expect(normalizeProfileConfig({ active: "tacones" })).toEqual({ active: "tacones" });
  });

  it("picks only selected questions of the profile's question profile, and maps them to local bank items", () => {
    const qs = [
      { id: 1, text: "A", profile: "ADULT", category: "Picante", answers: [{ text: "x", points: 10 }] },
      { id: 2, text: "B", profile: "DEFAULT", category: "", answers: [{ text: "y", points: 5 }] },
    ];
    expect(pickedQuestions(qs, "tacones", [1, 2]).map((q) => q.id)).toEqual([1]);
    expect(pickedQuestions(qs, "default", [1, 2]).map((q) => q.id)).toEqual([2]);
    expect(toBankItem(qs[0], 9)).toEqual({ id: "db-1", q: "A", cat: "Picante", updatedAt: 9, answers: [{ text: "x", pts: 10 }] });
  });
});
