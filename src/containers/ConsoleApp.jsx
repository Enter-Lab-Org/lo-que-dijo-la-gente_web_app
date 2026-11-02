import { useEffect, useState } from "react";
import { pubState } from "../domain/game";
import { TABS } from "../domain/constants";
import { SECTIONS, allowedSections } from "../domain/roles";
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
import UsersTab from "./UsersTab";
import NoAccess from "../components/auth/NoAccess";

/* The host console: wires the game, bank and theme containers to the adapters.
   sections: what the user's role may see (src/domain/roles.js); blocked tabs are not rendered at all. */
export default function ConsoleApp({ user = null, onLogout = null, sections = allowedSections(null) }) {
  const services = useServices();
  const { storage, bus } = services;
  const [boot] = useState(() => loadConsole(storage));
  const game = useGame({ storage, bus, initial: boot.state });
  const bankStore = useBank({ storage, initial: boot.bank });
  const themeStore = useTheme({ storage, bus, initial: boot.theme });
  const [savedTab, showTab] = useTab({ storage, initial: boot.tab });
  const tabs = TABS.filter((t) => sections.includes(t));
  const tab = tabs.includes(savedTab) ? savedTab : tabs[0] ?? null;
  const goTo = (t) => { if (tabs.includes(t)) showTab(t); };
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
      <ConsoleHeader tab={tab} tabs={tabs} onTab={goTo} native={services.native} user={user} onLogout={onLogout} />
      {tabs.length === 0 && <NoAccess />}
      {tabs.length > 0 && sections.includes(SECTIONS.PUBLIC) && <ProjectorContainer projector={services.projector} />}
      {tabs.includes("juego") && <section {...pane("juego")}><GameTab game={game} theme={themeStore.theme} onGoto={goTo} /></section>}
      {tabs.includes("banco") && <section {...pane("banco")}><BankTab bankStore={bankStore} game={game} themeStore={themeStore} files={services.files} /></section>}
      {tabs.includes("diseno") && <section {...pane("diseno")}><DesignTab themeStore={themeStore} pub={game.pub} images={services.images} /></section>}
      {tabs.includes("usuarios") && services.users && <section {...pane("usuarios")}>{tab === "usuarios" && <UsersTab api={services.users} currentUserId={user?.id} />}</section>}
    </div>
  );
}
