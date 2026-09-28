import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { swapConfig } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { fetchLivePrices } from "@/lib/swap-prices";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { identity, error } = await requireAuth();
  if (error) return error;

  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.toUpperCase();
  const to = url.searchParams.get("to")?.toUpperCase();
  const amount = parseFloat(url.searchParams.get("amount") || "0");

  if (!from || !to || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const prices = await fetchLivePrices([from, to]);
  const baseFrom = prices[from] ?? 0;
  const baseTo = prices[to] ?? 0;
  if (!baseFrom || !baseTo) {
    return NextResponse.json({ error: "Unsupported asset pair" }, { status: 400 });
  }

  try {
    let rate = baseFrom / baseTo;
    let feeBps = 50;

    const db = getDb();
    if (db) {
      const [config] = await db.select().from(swapConfig).where(
        and(eq(swapConfig.fromAsset, from), eq(swapConfig.toAsset, to))
      ).limit(1);
      if (config && config.active) {
        rate *= parseFloat(config.rateMultiplier);
        feeBps = config.feeBps;
      }
    }

    const fee = amount * (feeBps / 10000);
    const receiveAmount = amount * rate - fee;

    return NextResponse.json({
      from,
      to,
      fromAmount: amount,
      rate: rate.toFixed(8),
      fee: fee.toFixed(6),
      feeBps,
      receiveAmount: receiveAmount.toFixed(6),
    });
  } catch (err) {
    // Generic failure: keep the response shape stable ({ error }) and never
    // leak provider internals. Unknown errors are 500s, not empty arrays.
    console.error("[swap rate]", err);
    return NextResponse.json({ error: "Could not load swap rate." }, { status: 500 });
  }
}
