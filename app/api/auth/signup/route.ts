import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { referralLinks, referralAttributions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "@/lib/notifications";
import { buildEmailRedirectTo, getAllowedAppUrl } from "@/lib/auth-redirect";
import { checkAuthRateLimit, rateLimitHeaders, recordAuthFailure } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `signup:${forwarded || "unknown"}`;
}

export async function POST(request: Request) {
  try {
    const key = clientKey(request);
    const limit = await checkAuthRateLimit(key);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429, headers: { ...rateLimitHeaders(limit), "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json().catch(() => null) as { name?: string; email?: string; password?: string; referralCode?: string } | null;
    if (!body?.name || !body?.email || !body?.password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Strict allowlist + fail-closed in prod: never fall back to the request
    // origin (Host-header controlled) for email redirect links.
    const appUrl = getAllowedAppUrl();
    if ("error" in appUrl) {
      return NextResponse.json({ error: appUrl.error }, { status: 503 });
    }

    let supabase;
    try {
      supabase = await createClient();
    } catch {
      return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
    }
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { name: body.name },
        emailRedirectTo: buildEmailRedirectTo(appUrl.url, "/dashboard"),
      },
    });

    if (error) {
      await recordAuthFailure(key);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user) {
      const db = getDb();
      if (db) {
        try {
          await db.insert(users).values({
            id: data.user.id,
            name: body.name,
            email: body.email,
            emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
            role: 'investor',
          }).onConflictDoUpdate({
            target: users.id,
            set: {
              name: body.name,
              email: body.email,
              emailVerified: data.user.email_confirmed_at ? new Date(data.user.email_confirmed_at) : null,
              role: 'investor',
            },
          });
        } catch (insertError) {
          console.error('[auth signup profile insert skipped]', insertError);
        }

        if (body.referralCode) {
          try {
            const link = await db.select().from(referralLinks).where(eq(referralLinks.code, body.referralCode)).limit(1);
            if (link[0] && link[0].ownerId !== data.user.id) {
              const existingAttribution = await db.select().from(referralAttributions).where(eq(referralAttributions.referredInvestorId, data.user.id)).limit(1);
              if (!existingAttribution[0]) {
                await db.insert(referralAttributions).values({ referrerId: link[0].ownerId, referredInvestorId: data.user.id, linkId: link[0].id, status: 'active' });
              }
            }
          } catch (referralError) {
            console.error('[signup referral attribution]', referralError);
          }
        }

        if (data.session) { try { void sendWelcomeEmail(data.user.id).catch(welcomeError => console.error('[signup welcome email]', welcomeError)); } catch (welcomeError) { console.error('[signup welcome email]', welcomeError); } }
      }
    }

    // SECURITY: never return the Supabase session (access/refresh tokens) from
    // signup. The client obtains its own session via the auth callback /
    // email-confirmation flow. Leaking tokens here exposed them to logs and
    // any XSS present on the signup page.
    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email, name: body.name } : null,
      emailConfirmationRequired: !data.session,
    });
  } catch (err) {
    console.error('[auth signup]', err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
