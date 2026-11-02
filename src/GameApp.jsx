import { useEffect, useState } from "react";
import { PUBLIC_HASH } from "./domain/constants";
import { ServicesContext } from "./hooks/services";
import ConsoleApp from "./containers/ConsoleApp";
import PublicApp from "./containers/PublicApp";
import NoAccess from "./components/auth/NoAccess";
import { ACCESS, SECTIONS, allowedSections } from "./domain/roles";

// Same page, two views: the console by default, the public screen on #publico.
// user and onLogout come from the web host (login); the desktop app passes neither.
// access maps each role to its sections (src/domain/roles.js); tests inject a restricted one.
export default function App({ services, win = window, user = null, onLogout = null, access = ACCESS }) {
  const [hash, setHash] = useState(win.location.hash);
  useEffect(() => {
    const onHash = () => setHash(win.location.hash);
    win.addEventListener("hashchange", onHash);
    return () => win.removeEventListener("hashchange", onHash);
  }, [win]);
  const sections = allowedSections(user, access);
  const view = hash !== PUBLIC_HASH
    ? <ConsoleApp user={user} onLogout={onLogout} sections={sections} />
    : sections.includes(SECTIONS.PUBLIC) ? <PublicApp /> : <NoAccess />;
  return (
    <ServicesContext.Provider value={services}>
      {view}
    </ServicesContext.Provider>
  );
}
