# Feature: admin-users
Objective: an ADMIN-only console section to manage the users who can sign in. Branch: feat/libsql-driver (on top of a264cf8).
Delivery: ask-on-risk. Test runner: `npx vitest run`; build `npx next build`.

## Specs
- S1 "crea una seccion donde el ADMIN sera el unico con acceso." New section `usuarios` ("Usuarios" tab). In `ACCESS` only ADMIN has it. The desktop app (no login) never shows it.
- S2 "En esta seccion el ADMIN puede administrar los usuarios que pueden ingresar al sistema". Operations (assumption: the user named none; standard set chosen): list users (email, role, created date), create a user (email, password, role), change a user's role, reset a user's password, delete a user.
- S3 Enforced on the server: every `/api/users` request needs a valid session whose role can access `usuarios` (401 without session, 403 otherwise); mutating requests also require same origin (403). Password hashes are never returned.
- S4 Safety (assumption): an ADMIN cannot change their own role or delete themselves, so the system always keeps at least one ADMIN. Resetting a password or deleting a user ends that user's sessions. Role changes apply on the next request (the role is read through the session).
- S5 Same validation messages as `user:create` (email, password length, duplicate email, role).

## Tasks
- [x] T1 S2-S5 server: repository ports (list, updateRole, updatePassword, delete, sessions.deleteByUser) on both drivers + contract; auth service admin use cases; `/api/users` handlers and routes. Route: inline. Commit: see git log (feat(auth): user administration API). 284 tests green.
- [x] T2 S1-S2 UI: `usuarios` section in roles table, tab, UsersTab container + users API adapter, panel with list/create/role/reset/delete. Route: inline.
- [x] T3 docs (README); [x] independent verification — + independent verification (high risk: auth/permissions).

## Log
- L1 (2026-11-02) "bien, crea una seccion donde el ADMIN sera el unico con acceso.
En esta seccion el ADMIN puede administrar los usuarios que pueden ingresar al sistema"
- L2 Route declaration: inline for T1/T2 (one feature, no parallel independent units, no writer trigger). Waiting for the verifier of a264cf8 before editing source.
- L3 T1 committed c740eb7 (284 tests). T2: e2e against Turso found a real bug unit tests missed: Next bundles each route apart, so `instanceof AuthError` failed for the shared globalThis auth service -> 500 instead of 409. Fixed by matching `e.name`, pinned by a test. 298 tests green, `next build` ok, e2e (401 no cookie, list, 409 duplicate, role change, 403 cross-origin, 409 self delete, delete) all as specified; Turso left with only the admin user.
- L4 Verifier: PASS on S1-S5 except S4 under concurrency: two ADMINs demoting/deleting each other at once left zero ADMINs (reproduced on both drivers). Treated as blocker (S4 promises at least one ADMIN). Fix: the last-ADMIN condition lives in the UPDATE/DELETE statement itself (atomic), LAST_ADMIN -> 409 "Debe quedar al menos un ADMIN."; sqlite delete now one transaction. Recheck with the verifier's probes: mutual demotion [200, 409], mutual delete [200, 409]. 303 tests green. Advisories left: own password reset logs the admin out without redirect; 401 in the Usuarios tab only shows the message.
- L5 (2026-11-02) "Vamos a hacer una modificacion, Elimina el Rol de Guest y Dejalo OPERADOR como default". Done: roles are ADMIN and OPERADOR (default OPERADOR); migration 3 turns GUEST users into OPERADOR and adds triggers refusing other roles (no table rebuild: Turso enforces foreign keys and dropping users would cascade-delete sessions); libsql migrations now run each step in one write transaction instead of splitting on ";".
