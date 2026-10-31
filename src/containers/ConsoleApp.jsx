import { useEffect, useState } from "react";
import { pubState } from "../domain/game";
import { useServices } from "../hooks/services";
import { loadConsole } from "../hooks/loadConsole";
import { useGame } from "../hooks/useGame";
import { useBank } from "../hooks/useBank";
import { useTheme } from "../hooks/useTheme";
import { useTab } from "../hooks/useTab";
import { useGameKeys } from "../hooks/useGameKeys";
import ConsoleHeader from "../components/console/ConsoleHeader";
import ProjectorContainer from "./ProjectorContainer";
import GameTab from "./GameTab";
import BankTab from "./BankTab";
import DesignTab from "./DesignTab";

/* The host console: wires the game, bank and theme containers to the adapters. */
export default function ConsoleApp({ user = null, onLogout = null }) {
  const services = useServices();
  const { storage, bus } = services;
  const [boot] = useState(() => loadConsole(storage));
  const game = useGame({ storage, bus, initial: boot.state });
  const bankStore = useBank({ storage, initial: boot.bank });
  const themeStore = useTheme({ storage, bus, initial: boot.theme });
  const [tab, showTab] = useTab({ storage, initial: boot.tab });
  useGameKeys(tab === "juego", game.actions);

  useEffect(() => {
    document.title = "Lo Que Dijo la Gente · Consola";
    game.publish(game.current());
    // A public screen that just opened asks for the current state.
    return bus.on((m) => {
      if (m.kind === "hello") { bus.post({ kind: "theme", theme: themeStore.current() }); bus.post({ kind: "pub", pub: pubState(game.current()) }); }
    });
  }, [bus]);

  const pane = (key) => ({ className: "pane", id: "p-" + key, role: "tabpanel", "aria-labelledby": "tab-" + key, hidden: tab !== key });
  return (
    <div className="ctl" id="ctl">
      <ConsoleHeader tab={tab} onTab={showTab} native={services.native} user={user} onLogout={onLogout} />
      <ProjectorContainer projector={services.projector} />
      <section {...pane("juego")}><GameTab game={game} theme={themeStore.theme} onGoto={showTab} /></section>
      <section {...pane("banco")}><BankTab bankStore={bankStore} game={game} themeStore={themeStore} files={services.files} /></section>
      <section {...pane("diseno")}><DesignTab themeStore={themeStore} pub={game.pub} images={services.images} /></section>
    </div>
  );
}
