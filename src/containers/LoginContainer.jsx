"use client";
import { useState } from "react";
import LoginForm from "../components/auth/LoginForm";

const goToGame = () => window.location.assign("/");

/* Sends the credentials to the login API; the server sets the HttpOnly session cookie. */
export default function LoginContainer({ fetchImpl = (...a) => fetch(...a), onSuccess = goToGame }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(credentials) {
    setBusy(true);
    setError("");
    try {
      const res = await fetchImpl("/api/auth/login", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(credentials), credentials: "same-origin",
      });
      if (res.ok) { onSuccess(); return; }
      const body = await res.json().catch(() => ({}));
      setError(body.error || "No se pudo iniciar sesión.");
    } catch (e) {
      setError("No se pudo conectar con el servidor.");
    }
    setBusy(false);
  }

  return <LoginForm onSubmit={login} error={error} busy={busy} />;
}
