import { randomBytes } from "node:crypto";

/**
 * Generate a database password suitable for Supabase Postgres.
 *
 * Avoids characters that Postgres connection strings or shells routinely
 * mishandle (`@`, `:`, `/`, `?`, `#`, `"`, `'`, `\`, backtick, space).
 * 32 chars from the safe alphabet → ~190 bits of entropy.
 */
export function generateDbPassword(): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~";
  const buf = randomBytes(32);
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}
