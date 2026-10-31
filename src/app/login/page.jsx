import { redirect } from "next/navigation";
import { getCurrentUser } from "../../server/runtime.js";
import LoginContainer from "../../containers/LoginContainer";

export const metadata = { title: "Iniciar sesión · Lo Que Dijo la Gente" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return <LoginContainer />;
}
