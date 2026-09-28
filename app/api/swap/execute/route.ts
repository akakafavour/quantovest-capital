import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/db";
import { databaseUnavailable } from "@/lib/api-errors";
import { investorAccounts, portfolioHoldings, swapTransactions, swapConfig, portfolioLedger } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { fetchLivePricesOrThrow, isFiat } from "@/lib/swap-prices";

export const dynamic = "force-dynamic";

function computeSwapAmounts(fromAmount: number, rate: number, feeBps: number) {
  const toAmount = fromAmount * rate * (1 - feeBps / 10000);
  const feeAmount = fromAmount * rate * (feeBps / 10000);
  return { toAmount, feeAmount };
}

export async function POST(request: Request) {
  const { identity, error } = await requireAuth();
  if (error) return error;
  const db = getDb();
  if (!db) return databaseUnavailable("swap execute POST");

  const body = await request.json().catch(() => null) as {
    fromAsset?: string;
    toAsset?: string;
    fromAmount?: number;
  } | null;

  if (!body?.fromAsset || !body?.toAsset || !body?.fromAmount || body.fromAmount <= 0) {
    return NextResponse.json({ error: "Invalid swap parameters" }, { status: 400 });
  }

  const from = body.fromAsset.toUpperCase();
  const to = body.toAsset.toUpperCase();

  if (isFiat(from) && isFiat(to)) {
    return NextResponse.json({ error: "Cannot swap between fiat currencies" }, { status: 400 });
  }

  let feeBps = 50;
  let rateMultiplier = 1;
  const [config] = await db.select().from(swapConfig).where(
    and(eq(swapConfig.fromAsset, from), eq(swapConfig.toAsset, to))
  ).limit(1);
  if (config && config.active) {
    feeBps = config.feeBps;
    const parsed = parseFloat(config.rateMultiplier);
    if (Number.isFinite(parsed) && parsed > 0) rateMultiplier = parsed;
  }

  let prices: Record<string, number>;
  try {
    prices = await fetchLivePricesOrThrow([from, to]);
  } catch (err) {
    console.error("[swap execute] price fetch failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not fetch asset prices" }, { status: 502 });
  }
  const fromPrice = prices[from] ?? 0;
  const toPrice = prices[to] ?? 0;
  if (!fromPrice || !toPrice) {
    return NextResponse.json({ error: "Could not fetch asset prices" }, { status: 502 });
  }

  const fromUsdValue = body.fromAmount * fromPrice;
  const fromUsdValueCents = Math.round(fromUsdValue * 100);

  try {
    const result = await db.transaction(async tx => {
      const [account] = await tx.select().from(investorAccounts).where(
        and(eq(investorAccounts.investorId, identity.id), eq(investorAccounts.status, "active"))
      ).limit(1).for("update");

      if (!account) {
        throw new Error("No active investor account found");
      }

      if (isFiat(from)) {
        if (account.balanceCents < fromUsdValueCents) {
          throw new Error("Insufficient balance");
        }
      } else {
        const [holding] = await tx.select().from(portfolioHoldings).where(
          and(eq(portfolioHoldings.investorId, identity.id), eq(portfolioHoldings.assetSymbol, from))
        ).limit(1).for("update");
        if (!holding || parseFloat(holding.quantity) < body.fromAmount!) {
          throw new Error("Insufficient balance");
        }
      }

      const rate = (fromPrice / toPrice) * rateMultiplier;
      const { toAmount, feeAmount } = computeSwapAmounts(body.fromAmount!, rate, feeBps);

      if (isFiat(from)) {
        const deductionCents = fromUsdValueCents;
        await tx.update(investorAccounts).set({
          balanceCents: account.balanceCents - deductionCents,
          updatedAt: new Date(),
        }).where(eq(investorAccounts.id, account.id));
      } else {
        const [holding] = await tx.select().from(portfolioHoldings).where(
          and(eq(portfolioHoldings.investorId, identity.id), eq(portfolioHoldings.assetSymbol, from))
        ).limit(1).for("update");
        const newQty = parseFloat(holding!.quantity) - body.fromAmount!;
        if (newQty <= 0) {
          await tx.delete(portfolioHoldings).where(eq(portfolioHoldings.id, holding!.id));
        } else {
          await tx.update(portfolioHoldings).set({
            quantity: newQty.toString(),
            updatedAt: new Date(),
          }).where(eq(portfolioHoldings.id, holding!.id));
        }
      }

      if (!isFiat(to)) {
        const toName = to === "BTC" ? "Bitcoin" : to === "ETH" ? "Ethereum" : to === "SOL" ? "Solana" : to;
        const [existing] = await tx.select().from(portfolioHoldings).where(
          and(eq(portfolioHoldings.investorId, identity.id), eq(portfolioHoldings.assetSymbol, to))
        ).limit(1);

        if (existing) {
          const newQty = parseFloat(existing.quantity) + toAmount;
          const newCostBasis = existing.costBasisCents + fromUsdValueCents;
          await tx.update(portfolioHoldings).set({
            quantity: newQty.toString(),
            costBasisCents: newCostBasis,
            currentPriceCents: Math.round(toPrice * 100),
            updatedAt: new Date(),
          }).where(eq(portfolioHoldings.id, existing.id));
        } else {
          await tx.insert(portfolioHoldings).values({
            investorId: identity.id,
            assetSymbol: to,
            assetName: toName,
            quantity: toAmount.toString(),
            costBasisCents: fromUsdValueCents,
            currentPriceCents: Math.round(toPrice * 100),
          });
        }
      } else {
        const receivedUsdCents = Math.round(toAmount * 100);
        await tx.update(investorAccounts).set({
          balanceCents: account.balanceCents + receivedUsdCents,
          updatedAt: new Date(),
        }).where(eq(investorAccounts.id, account.id));
      }

      const [inserted] = await tx.insert(swapTransactions).values({
        investorId: identity.id,
        fromAsset: from,
        toAsset: to,
        fromAmount: body.fromAmount!.toString(),
        toAmount: toAmount.toFixed(6),
        rate: rate.toFixed(8),
        feeCents: Math.round(feeAmount * toPrice * 100),
        status: "completed",
      }).returning({ id: swapTransactions.id });

      const ledgerAmountCents = isFiat(from) ? -fromUsdValueCents : Math.round(toAmount * 100);
      const description = isFiat(from)
        ? `Swapped $${fromUsdValue.toFixed(2)} USD to ${toAmount.toFixed(6)} ${to}`
        : `Swapped ${body.fromAmount!.toString()} ${from} to $${(toAmount * toPrice).toFixed(2)} USD`;

      await tx.insert(portfolioLedger).values({
        investorId: identity.id,
        type: "swap",
        amountCents: ledgerAmountCents,
        referenceId: String(inserted.id),
        description,
      });

      return {
        id: inserted.id,
        from,
        to,
        fromAmount: body.fromAmount!,
        toAmount: toAmount.toFixed(6),
        rate: rate.toFixed(8),
        fee: feeAmount.toFixed(6),
        feeBps,
        status: "completed",
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Swap failed";
    if (message === "Insufficient balance") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message === "No active investor account found") {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    // Generic 500: never echo err.message for unknown failures — it can leak
    // provider/DB internals (table names, balances, upstream payloads).
    console.error("[swap execute]", err);
    return NextResponse.json({ error: "Swap failed. Please try again." }, { status: 500 });
  }
}
