import "server-only";

/**
 * Strict allowlist for user-facing redirect/email-link hosts.
 * Prod canonical host: www.quantovests.com (apex quantovests.com included
 * so both DNS entries work; everything else is rejected).
 */
const PROD_HOSTS = new Set(["www.quantovests.com", "quantovests.com"]);

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function getAllowedAppUrl(): { url: string } | { error: string } {
  const raw = process.env.APP_PUBLIC_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";

  // Fail closed in prod: never derive the public URL from the request origin
  // (attacker-controlled Host header -> open-redirect / phishing links).
  if (!raw) {
    if (isProd) return { error: "Service temporarily unavailable: APP_PUBLIC_URL is not configured." };
    return { url: "http://localhost:3000" };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "Service temporarily unavailable: APP_PUBLIC_URL is invalid." };
  }

  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && (isLocalHost(parsed.hostname) || !isProd))) {
    return { error: "Service temporarily unavailable: APP_PUBLIC_URL must use HTTPS in production." };
  }

  if (isProd && !PROD_HOSTS.has(parsed.hostname.toLowerCase())) {
    return { error: "Service temporarily unavailable: APP_PUBLIC_URL host is not allowlisted." };
  }

  // Strip trailing slashes so `${url}/auth/callback…` never yields `//`.
  return { url: parsed.origin };
}

export function buildEmailRedirectTo(appUrl: string, next = "/dashboard"): string {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return `${appUrl}/auth/callback?next=${encodeURIComponent(safeNext)}`;
}
