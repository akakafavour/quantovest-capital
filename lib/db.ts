import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

let client: postgres.Sql | undefined;

function getClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password) return null;
  } catch {
    return null;
  }
  client ??= postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Never disable certificate verification in production: a MITM with a
    // forged cert could otherwise intercept database traffic unnoticed.
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: true },
  });
  return client;
}

export function getDb() {
  const c = getClient();
  if (!c) return null;
  return drizzle(c, { schema });
}

export { getClient };
