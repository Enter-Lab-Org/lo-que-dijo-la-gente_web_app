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
import AdminTab from "./AdminTab";
import { useProfile } from "../hooks/useProfile";
import { useProfileStyle } from "../hooks/useProfileStyle";
import { getProfile } from "../domain/profiles";
import NoAccess from "../components/auth/NoAccess";

/* The host console: wires the game, bank, theme and profile containers to the adapters.
   sections: what the user's role may see (src/domain/roles.js); blocked tabs are not rendered at all. */
export default function ConsoleApp({ user = null, onLogout = null, sections = allowedSections(null) }) {
  const services = useServices();
  const { storage, bus } = services;
  const [boot] = useState(() => loadConsole(storage));
  const game = useGame({ storage, bus, initial: boot.state });
  const bankStore = useBank({ storage, initial: boot.bank });
  const themeStore = useTheme({ storage, bus, initial: boot.theme });
  const profileStore = useProfile({ storage, bankStore, themeStore });
  useProfileStyle(themeStore.theme.profile);
  const [savedTab, showTab] = useTab({ storage, initial: boot.tab });
  // The admin panel needs the web server's bank API (the desktop app has none).
  const tabs = TABS.filter((t) => sections.includes(t) && (t !== SECTIONS.ADMIN || services.bankApi));
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
      <ConsoleHeader tab={tab} tabs={tabs} onTab={goTo} native={services.native} user={user} onLogout={onLogout} brand={getProfile(themeStore.theme.profile).name} />
      {tabs.length === 0 && <NoAccess />}
      {tabs.length > 0 && sections.includes(SECTIONS.PUBLIC) && <ProjectorContainer projector={services.projector} />}
      {tabs.includes("juego") && <section {...pane("juego")}><GameTab game={game} theme={themeStore.theme} onGoto={goTo} /></section>}
      {tabs.includes("banco") && <section {...pane("banco")}><BankTab bankStore={bankStore} game={game} themeStore={themeStore} files={services.files} /></section>}
      {tabs.includes("diseno") && <section {...pane("diseno")}><DesignTab themeStore={themeStore} pub={game.pub} images={services.images} /></section>}
      {tabs.includes("admin") && (
        <section {...pane("admin")}>
          {tab === "admin" && <AdminTab api={services.bankApi} usersApi={services.users} canManageUsers={sections.includes(SECTIONS.USERS)}
            currentUserId={user?.id} profileStore={profileStore} />}
        </section>
      )}
    </div>
  );
}
