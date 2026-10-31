import { KEYS, TABS } from "../domain/constants";
import { normState } from "../domain/game";
import { sanitizeBank } from "../domain/bank";
import { normalizeTheme } from "../domain/theme";
import { seedFirstRun } from "../domain/samples";

/* Console start: read saved data, seed the samples on the first run, and write back the clean versions. */
export function loadConsole(storage) {
  const savedBank = storage.get(KEYS.bank);
  const seeded = !!storage.get(KEYS.seeded);
  const seed = seedFirstRun({ state: normState(storage.get(KEYS.state)), bank: Array.isArray(savedBank) ? savedBank : [], seeded });
  if (seed.changed) storage.set(KEYS.state, seed.state);
  if (!seeded) storage.set(KEYS.seeded, true);
  const bank = sanitizeBank(seed.bank);
  storage.set(KEYS.bank, bank);
  const theme = normalizeTheme(storage.get(KEYS.theme));
  storage.set(KEYS.theme, theme);
  const tab = storage.get(KEYS.tab);
  return { state: seed.state, bank, theme, tab: TABS.includes(tab) ? tab : "juego" };
}
