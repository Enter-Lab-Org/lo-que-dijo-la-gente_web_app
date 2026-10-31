/* Presentational login form. The container owns the request and the redirect. */
export default function LoginForm({ onSubmit, error = "", busy = false }) {
  const submit = (e) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSubmit({ email: String(f.get("email") || ""), password: String(f.get("password") || "") });
  };
  return (
    <main className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="login-brand"><span className="c-logo">Lo que dijo la gente</span></div>
        <h3>Iniciar sesión</h3>
        <label className="field"><span>Correo</span>
          <input type="email" name="email" autoComplete="username" required maxLength={254} />
        </label>
        <label className="field"><span>Contraseña</span>
          <input type="password" name="password" autoComplete="current-password" required maxLength={1024} />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" className="btn gold" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </main>
  );
}
