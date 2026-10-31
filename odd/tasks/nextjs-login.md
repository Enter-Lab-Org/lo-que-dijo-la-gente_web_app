# Feature: nextjs-login
Objective: migrate the web app from React+Vite to Next.js and gate the game behind a login backed by a local SQLite database behind a swappable adapter.
Branch: none (lo-que-dijo-la-gente_web_app is not a git repository; commits pending user decision). Delivery: ask-on-risk. Test runner: Vitest (`npx vitest run`).

## Specs
- S1. "cambiar el proyecto de React a Nextjs para implementar una API para el login". The game (console + `#publico` public screen) keeps working unchanged in Next.js; existing component/domain tests keep passing.
- S2. "solo el usuario que este logeado en una base de datos puede acceder al juego". Without a valid session, `/` redirects to `/login`; the session is validated server-side against the database (proxy only does an optimistic cookie check).
- S3. Login API: `POST /api/auth/login` (email + password) sets an HttpOnly, SameSite=Lax (Secure in production) session cookie; wrong credentials return a generic error that does not reveal whether the email exists; repeated failures are rate limited (429).
- S4. "crea una local usando SQLite, manten adapter para poder cambiar de motor de DB a posterior". SQLite file database (`node:sqlite`, no native dependency) behind repository ports (`users`, `sessions`); the engine is chosen in one factory by `DB_DRIVER`.
- S5. Assumption (no signup was requested): users are created by an admin script `npm run user:create`; passwords are stored only as scrypt hashes; session tokens are stored hashed.
- S6. Assumption: logout (`POST /api/auth/logout`) deletes the session; a "Cerrar sesión" button appears in the console header only when the host passes `onLogout`, so the shared component stays compatible with the Electron copy.
- S7. Security headers move from the meta CSP to HTTP headers (including `frame-ancestors 'none'`).

## Tasks
- [x] T1 (S1, S7) Next.js migration of the frontend · route: inline · GREEN: 198/198 existing tests, next build OK
- [x] T2 (S4, S5) DB ports + SQLite adapter + user script · route: inline · RED observed (missing modules) → GREEN 22 server tests
- [x] T3 (S2, S3, S6) Auth service, API routes, guard, login page, logout · route: inline · RED observed → GREEN 235 total; e2e curl + Chrome check
- [x] T4 Independent verification (Risk item 2: auth) · route: delegated verifier · S1,S2,S4,S6,S7 PASS; S3 blocker fixed and rechecked

Route evidence: units depend on each other (T3 needs T1 and T2), so no parallel-writer reason; inline.

## Log
- L1 (2026-10-30) "Bien, arregla el 1 y el 2. Posterior a ello, en la version web, debemos implementar un sistema de login. En esta primera etapa, solo el usuario que este logeado en una base de datos puede acceder al juego. Antes de proceder con el backend, pasemos a una fase de planeacion"
- L2 (2026-10-30) "Que posibilidades hay de cambiar el proyecto de React a Nextjs para implementar una API para el login?"
- L3 (2026-10-30) "bien vamos con NextJS, aun estoy pensando la base de datos a usar. por el momento crea una local usando SQLite, manten adapter para poder cambiar de motor de DB a posterior"
- L4 Next 16.4.3, Node 24.18 (`node:sqlite` available). Next docs: proxy runs on Node but should only do optimistic cookie checks; real checks near the data.
- L5 T1-T3 done. Decisions: node:sqlite (no native dep); async repository ports + describeRepositoryContract for future engines; scrypt hashes; DB-backed sessions with SHA-256 token hashes; proxy optimistic, page validates. Next sets X-Forwarded-For with ??= (base-server.js:601) so it is spoofable: used only with TRUST_PROXY=1, otherwise rate limit per email. App.jsx renamed GameApp.jsx (src/app clash on case-insensitive FS).
- L6 Evidence: vitest 235/235; next build OK; e2e: / without/fake cookie → 307 /login, bad login 401 generic, cross-origin 403, ok 200 + HttpOnly/SameSite=Lax/Secure cookie, logout invalidates token, 6th failure → 429; Chrome: login → game renders, no console errors, logout → /login. Not checked in browser: public screen popup.
- L7 Baseline snapshot (pre-migration) at scratchpad web_app-baseline.tgz. No git repo: no commits made.
- L8 Verifier: S3 BLOCKER — a parallel burst of 40 wrong logins all got 401 (check before await, fail recorded after). Fix: count the attempt before any await, reset on success (service.js). RED test observed, GREEN 237/237; recheck burst of 40 → 5×401, 35×429.
- L9 Advisories kept open (not requested): scrypt N=2^14 below OWASP 2^17; without TRUST_PROXY an attacker can lock out a known email for 15 min; in-memory limiter is per process. Verifier's S7 note is a misread: the old CSP was injected at build time by the Vite plugin, not written in index.html.
- L10 Engram mirror saved in project "lo-que-dijo-la-gente" (workspace folder name, chosen by the user), topic odd/nextjs-login/tasks.
