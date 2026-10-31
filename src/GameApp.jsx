import { useEffect, useState } from "react";
import { PUBLIC_HASH } from "./domain/constants";
import { ServicesContext } from "./hooks/services";
import ConsoleApp from "./containers/ConsoleApp";
import PublicApp from "./containers/PublicApp";

// Same page, two views: the console by default, the public screen on #publico.
// user and onLogout come from the web host (login); the desktop app passes neither.
export default function App({ services, win = window, user = null, onLogout = null }) {
  const [hash, setHash] = useState(win.location.hash);
  useEffect(() => {
    const onHash = () => setHash(win.location.hash);
    win.addEventListener("hashchange", onHash);
    return () => win.removeEventListener("hashchange", onHash);
  }, [win]);
  return (
    <ServicesContext.Provider value={services}>
      {hash === PUBLIC_HASH ? <PublicApp /> : <ConsoleApp user={user} onLogout={onLogout} />}
    </ServicesContext.Provider>
  );
}
