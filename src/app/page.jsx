import { redirect } from "next/navigation";
import { getCurrentUser } from "../server/runtime.js";
import GameClient from "./GameClient";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <GameClient user={user} />;
}
