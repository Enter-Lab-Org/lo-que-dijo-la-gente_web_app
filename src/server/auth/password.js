import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Stored as "scrypt$N$r$p$salt$hash" (base64url) so the cost can be raised later without breaking old hashes.
const N = 16384, R = 8, P = 1, KEYLEN = 64;

const derive = (password, salt, n, r, p) => new Promise((resolve, reject) => {
  scrypt(password, salt, KEYLEN, { N: n, r, p, maxmem: 256 * n * r }, (err, key) => (err ? reject(err) : resolve(key)));
});

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password, stored) {
  const [alg, n, r, p, salt, hash] = String(stored || "").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  try {
    const expected = Buffer.from(hash, "base64url");
    const key = await derive(password, Buffer.from(salt, "base64url"), Number(n), Number(r), Number(p));
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch (e) {
    return false;
  }
}
