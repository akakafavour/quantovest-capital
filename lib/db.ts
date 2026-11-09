import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

let client: postgres.Sql | undefined;

function getClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || url.includes('<FILL')) return null;
  let hostname = '';
  try {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password) return null;
    hostname = parsed.hostname;
  } catch {
    return null;
  }

  if (!client) {
    const caCert = process.env.SUPABASE_POOLER_CA_CERT;
    const isPooler = /\.pooler\.supabase\.com$/.test(hostname);

    const sslConfig = url.includes('localhost')
      ? false
      : isPooler && caCert
        ? { rejectUnauthorized: true, ca: caCert }
        : isPooler
          ? { rejectUnauthorized: false }
          : { rejectUnauthorized: true };

    client = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 15,
      connect_timeout: 10,
      ssl: sslConfig,
      onclose: () => {
        client = undefined;
      },
    });
  }
  return client;
}

export function getDb() {
  const c = getClient();
  if (!c) return null;
  return drizzle(c, { schema });
}

export { getClient };
