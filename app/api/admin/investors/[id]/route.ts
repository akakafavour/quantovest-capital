import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/lib/supabase/identity";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await getCurrentIdentity();
    if (!actor || actor.role !== "admin") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getDb();
    if (!db) return NextResponse.json({ error: "Database not configured" }, { status: 503 });

    const { id } = await params;
    const body = await request.json().catch(() => null) as { name?: string; phone?: string } | null;
    if (!body) return NextResponse.json({ error: "Request body required" }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (body.name?.trim()) updates.name = body.name.trim();
    if (body.phone?.trim()) updates.phone = body.phone.trim();

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    await db.update(users).set(updates).where(eq(users.id, id));
    return NextResponse.json({ updated: true });
  } catch (err) {
    console.error('[admin investors PATCH]', err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
