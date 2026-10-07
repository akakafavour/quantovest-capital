import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { plans } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { identity, error } = await requireAdmin();
    if (error) return error;
    const db = getDb();
    if (!db) return NextResponse.json([]);
    const rows = await db.select().from(plans);
    return NextResponse.json(rows);
  } catch (err) {
    console.error('[plans]', err);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { identity, error } = await requireAdmin();
    if (error) return error;
    const db = getDb();
    if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

    const body = await request.json();
    const { name, minimumDepositCents, maximumDepositCents, minRoiBps, maxRoiBps } = body;

    if (!name || minimumDepositCents == null || minRoiBps == null || maxRoiBps == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [inserted] = await db
      .insert(plans)
      .values({
        name,
        minimumDepositCents: Number(minimumDepositCents),
        maximumDepositCents: maximumDepositCents != null ? Number(maximumDepositCents) : null,
        minRoiBps: Number(minRoiBps),
        maxRoiBps: Number(maxRoiBps),
        active: 1,
      })
      .returning();

    await logAuditEvent(identity.id, "plan_created", "plan", inserted.id, { name });

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    console.error('[plans POST]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { identity, error } = await requireAdmin();
    if (error) return error;
    const db = getDb();
    if (!db) return NextResponse.json({ error: "Database is not configured" }, { status: 503 });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: "Plan id is required" }, { status: 400 });

    const sanitized: Record<string, unknown> = {};
    if (updates.name !== undefined) sanitized.name = updates.name;
    if (updates.minimumDepositCents !== undefined) sanitized.minimumDepositCents = Number(updates.minimumDepositCents);
    if (updates.maximumDepositCents !== undefined) sanitized.maximumDepositCents = updates.maximumDepositCents != null ? Number(updates.maximumDepositCents) : null;
    if (updates.minRoiBps !== undefined) sanitized.minRoiBps = Number(updates.minRoiBps);
    if (updates.maxRoiBps !== undefined) sanitized.maxRoiBps = Number(updates.maxRoiBps);
    if (updates.active !== undefined) sanitized.active = updates.active ? 1 : 0;

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const [updated] = await db.update(plans).set(sanitized).where(eq(plans.id, Number(id))).returning();

    if (!updated) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

    await logAuditEvent(identity.id, "plan_updated", "plan", updated.id, sanitized);

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[plans PATCH]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
