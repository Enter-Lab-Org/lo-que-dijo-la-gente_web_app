# Lo Que Dijo la Gente · Next.js web app

Next.js (App Router) port of the offline team survey game ("Family Feud" style). Same features, look, Spanish (es-MX) copy,
storage keys and backup format as the original single-file app (`../lo-que-dijo-la-gente/app/index.html`).

- **Login** (`/login`): only users stored in the database can open the game. There is no public signup.
- **Console** (default URL): host controls, question bank, client design, live monitor.
- **Public screen** (`#publico`): read-only board for the projector. The console opens it with
  "Abrir pantalla del público" and keeps it in sync over `BroadcastChannel("ldlg-v2")` + `postMessage`.

The game itself runs in the browser (no SSR): fonts are bundled from `src/styles/fonts`, sounds are synthesized with WebAudio.

## Scripts

| Command | What it does |
| --- | --- |
| `npm install` | Install the pinned dependencies |
| `npm run user:create -- <email>` | Create a user (asks for the password, or reads `LDLG_USER_PASSWORD`) |
| `npm run dev` | Dev server on http://localhost:8081 |
| `npm test` | Vitest in watch mode (`npm test -- --run` for a single run) |
| `npm run build` | Production build into `.next/` |
| `npm start` | Serve the production build on http://localhost:8081 |

Requires Node 22.13+ (the `sqlite` driver uses the built-in `node:sqlite`).

## Login and database

| Variable | Default | Meaning |
| --- | --- | --- |
| `DB_DRIVER` | `sqlite` | Database engine: `sqlite` (local file, `node:sqlite`) or `libsql` (Turso, via `@libsql/client`) |
| `DATABASE_URL` | `data/ldlg.db` | `sqlite`: file path (`file:` prefix and `:memory:` accepted), created on first use. `libsql`: required, e.g. `libsql://<db>-<org>.<region>.turso.io` (also `file:` / `:memory:`) |
| `DATABASE_AUTH_TOKEN` | unset | Turso database token (`libsql` only). Secret: keep it in `.env.local`, never in git |
| `COOKIE_SECURE` | `true` in production | Set `false` to serve over plain http on a LAN (`localhost` works either way) |
| `TRUST_PROXY` | unset | Set `1` only behind a reverse proxy that sets `X-Forwarded-For`; enables per-IP rate limits |

- Secrets go in `.env.local` (git-ignored). `npm run dev` / `npm start` and `npm run user:create` all read it. Example:

  ```
  DB_DRIVER=libsql
  DATABASE_URL=libsql://<db>-<org>.<region>.turso.io
  DATABASE_AUTH_TOKEN=<token from the Turso dashboard or `turso db tokens create <db>`>
  ```

- Both drivers share the schema in `src/server/db/sqlite/migrations.js`; `libsql` tracks applied versions in a
  `schema_migrations` table and applies pending ones on first use.
- Passwords are stored as scrypt hashes; the session cookie (`ldlg_session`, HttpOnly, SameSite=Lax, 7 days)
  holds a random token and the database stores only its SHA-256.
- `src/proxy.js` only checks that the cookie exists; `src/app/page.jsx` validates the session against the database.
- Failed logins are limited to 5 per email (and IP, with `TRUST_PROXY`) every 15 minutes, in memory.
- **Changing the engine:** implement the `users` / `sessions` / `close` ports in `src/server/db/<engine>/`, make it pass
  `describeRepositoryContract` (`src/server/db/contract.js`), and register it in `src/server/db/index.js`.

## Structure

```
src/
  domain/       Pure game logic, no React or DOM: game state and actions, bank, text format,
                theme, public screen rules, projector texts, sample questions
  adapters/     Side effects behind small interfaces: storage, bus, audio, files, images, projector
                Each one uses the Electron bridge (window.ldlg) when present, browser APIs otherwise
  hooks/        Containers as hooks: useGame, useBank, useTheme, useTab, useGameKeys, loadConsole...
  containers/   ConsoleApp, PublicApp and the three console tabs; they wire hooks to components
  components/   Presentational components
    atoms/      ArmedButton (two-click confirm), SyncedInput, CommitInput
    screen/     PublicScreen, Board, AnswerTile, TeamScore, PotDisplay, StrikeIndicators, BigX, Monitor
    console/    ConsoleHeader, Tabs, ProjectorPanel, HostPanel, AnswerList, StrikeControls, PotPanel,
                MultiplierSelector, TeamsPanel, Playlist, KeyboardHint
    bank/       BankToolbar, BankList, BankItem, QuestionForm, ImportPanel, BackupPanel
    design/     DesignPanel, ImageSlot
    public/     StartOverlay, CornerControls
  styles/       app.css (copied from the original) and local fonts (OFL)
  GameApp.jsx   Routes by hash: console or public screen
  Game.jsx      Creates the browser services once and renders GameApp
  app/          Next.js routes: layout, / (guarded game), /login, /api/auth/login, /api/auth/logout
  proxy.js      Optimistic redirect to /login when there is no session cookie
  server/       Server only: auth/ (passwords, sessions, rate limit), db/ (ports, contract, sqlite adapter),
                http/ (framework-free login/logout handlers), cli/ (user:create), runtime.js (Next wiring)
```

Data flow: a UI event calls a pure action in `domain/game.js` → the hook stamps a new `rev`, saves the state,
builds `pubState` (only revealed answers + answer count) and posts it on the bus → the public screen applies it
only if its `rev` is newer.

## Native bridge (Electron)

When `window.ldlg.native` is true (see `../lo-que-dijo-la-gente/preload.js`) the adapters switch to:
`load/save` (storage), `send/on` (bus), `exportFile/importFile` (files), `displays/onDisplays/place/windowed/toggle/escape`
(projector panel and Esc on the public screen). The desktop app keeps its own Vite build (`../lo-que-dijo-la-gente_electron_app`).

## Storage keys

`ldlg-v2` (game), `ldlg-pub` (public state), `ldlg-theme-v2` (design), `ldlg-banco` (bank), `ldlg-tab`, `ldlg-seeded`.
