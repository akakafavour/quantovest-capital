import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDb } from "@/lib/db";
import { referralLinks, referralAttributions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendWelcomeEmail } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { name?: string; email?: string; password?: string; referralCode?: string } | null;
    if (!body?.name || !body?.email || !body?.password) {
      return NextResponse.json({ error: "Name, email, and password are required" }, { status: 400 });
    }
    if (body.password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const supabase = await createClient();
    const appUrl = process.env.APP_PUBLIC_URL || new URL(request.url).origin;
    const { data, error } = await supabase.auth.signUp({
      email: body.email,
      password: body.password,
      options: {
        data: { name: body.name },
        emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
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

    return NextResponse.json({
      user: data.user ? { id: data.user.id, email: data.user.email, name: body.name } : null,
      session: data.session,
    });
  } catch (err) {
    console.error('[auth signup]', err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
