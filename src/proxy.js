import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "./server/http/handlers.js";

/* Optimistic check only (no database): without a session cookie, pages go straight to /login.
   API routes are excluded: each one checks the session itself and answers JSON (401/403).
   The page itself validates the session against the database (src/app/page.jsx). */
export function proxy(request) {
  if (!request.cookies.get(SESSION_COOKIE)) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!login|api/|_next/static|_next/image|favicon.ico).*)"] };
