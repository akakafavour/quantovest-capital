import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { portfolioLedger } from "@/db/schema";

export const dynamic = "force-dynamic";

function sanitizeCsvCell(value: string): string {
  const trimmed = value.trim();
  let safe = trimmed;
  if (/^[=+\-@\t\r]/.test(safe)) {
    safe = `'${safe}`;
  }
  return safe.replace(/"/g, '""');
}

export async function GET(request: Request) {
  const { identity, error } = await requireAuth();
  if (error) return error;
  const db = getDb();
  if (!db) return NextResponse.json([]);

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as "deposit" | "roi" | "profit" | "credit" | "withdrawal" | "swap" | "referral_reward" | "adjustment" | "plan_assignment" | "plan_assigned" | "plan_purchase" | "plan_upgrade" | null;
    const conditions = [eq(portfolioLedger.investorId, identity.id)];
    if (type) conditions.push(eq(portfolioLedger.type, type));
    const rows = await db.select().from(portfolioLedger).where(and(...conditions));

    const header = "Date,Type,Amount (USD),Description,Reference\n";
    const csv = rows.map(r => {
      const date = new Date(r.createdAt).toLocaleDateString('en-US');
      const amount = (r.amountCents / 100).toFixed(2);
      const desc = sanitizeCsvCell(r.description ?? '');
      const ref = sanitizeCsvCell(r.referenceId ?? '');
      return `"${date}","${r.type}","${amount}","${desc}","${ref}"`;
    }).join("\n");

    return new NextResponse(header + csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="transaction-history.csv"`,
      },
    });
  } catch {
    return NextResponse.json([]);
  }
}
