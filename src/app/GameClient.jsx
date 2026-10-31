"use client";
import dynamic from "next/dynamic";

// The game uses window, localStorage, BroadcastChannel and the URL hash, so it only renders in the browser.
const Game = dynamic(() => import("../Game"), { ssr: false });

async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); } catch (e) {}
  window.location.assign("/login");
}

export default function GameClient({ user }) {
  return <Game user={user} onLogout={logout} />;
}
