#!/usr/bin/env node
// npm run user:create -- <email>. Uses the same DB_DRIVER / DATABASE_URL as the server.
import { createInterface } from "node:readline";
import { createDatabase } from "../src/server/db/index.js";
import { createAuthService } from "../src/server/auth/service.js";
import { createUserCommand } from "../src/server/cli/createUser.js";

// Reads a line without echoing it, so the password does not stay on screen.
function readPassword(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(prompt)) process.stdout.write(s); };
    rl.question(prompt, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

const db = createDatabase();
try {
  process.exitCode = await createUserCommand({
    args: process.argv.slice(2), env: process.env, auth: createAuthService({ db }),
    readPassword, log: console.log, error: console.error,
  });
} finally {
  db.close();
}
