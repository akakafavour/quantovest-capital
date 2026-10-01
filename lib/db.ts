import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

let client: postgres.Sql | undefined;

function getClient() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  let hostname = '';
  try {
    const parsed = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname || !parsed.username || !parsed.password) return null;
    hostname = parsed.hostname;
  } catch {
    return null;
  }
  client ??= postgres(url, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    // Supabase's PgBouncer pooler presents a certificate chain that Node
    // cannot verify against public roots (SELF_SIGNED_CERT_IN_CHAIN), so the
    // pooler documented posture is TLS encryption without chain verification
    // (equivalent to sslmode=require). Full verification stays on everywhere
    // else; localhost stays plaintext.
    ssl: url.includes('localhost')
      ? false
      : /\.pooler\.supabase\.com$/.test(hostname)
        ? { rejectUnauthorized: false }
        : { rejectUnauthorized: true },
  });
  return client;
}

export function getDb() {
  const c = getClient();
  if (!c) return null;
  return drizzle(c, { schema });
}

export { getClient };
