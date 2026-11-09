import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const { identity, error } = await requireAuth();
  if (error) return error;
  const db = getDb();
  if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

  try {
    const body = await request.json().catch(() => null) as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
    } | null;

    if (!body?.endpoint || !body?.p256dh || !body?.auth || !body.endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const existing = await db.select().from(pushSubscriptions).where(
      eq(pushSubscriptions.endpoint, body.endpoint)
    );

    if (existing.length === 0) {
      await db.insert(pushSubscriptions).values({
        userId: identity.id,
        endpoint: body.endpoint,
        p256dh: body.p256dh,
        auth: body.auth,
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[push subscribe]", err);
    return NextResponse.json({ error: "Subscribe failed." }, { status: 500 });
  }
}
