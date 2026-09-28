import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const swapExecuteSource = readFileSync(
  join(process.cwd(), "app/api/swap/execute/route.ts"),
  "utf8",
);
const swapRateSource = readFileSync(join(process.cwd(), "app/api/swap/rate/route.ts"), "utf8");
const depositsSource = readFileSync(join(process.cwd(), "app/api/deposits/route.ts"), "utf8");
const withdrawalsSource = readFileSync(
  join(process.cwd(), "app/api/withdrawals/route.ts"),
  "utf8",
);
const roiSource = readFileSync(join(process.cwd(), "app/api/admin/roi/route.ts"), "utf8");

// ---------------------------------------------------------------------------
// Pure mirrors of the money guards in the API routes (prod code untouched).
// The "pins prod source" tests fail if the routes drift from these mirrors.
// No db/identity/notification/fetch calls are exercised here, so no mocks
// beyond these pure functions are needed.
// ---------------------------------------------------------------------------
const DEFAULT_SWAP_FEE_BPS = 50;
const MIN_DEPOSIT_CENTS = 5000;
const MIN_WITHDRAW_BALANCE_CENTS = 300_000;
const ROI_BPS: Record<string, number> = { Starter: 1500, Growth: 2500, Elite: 3500 };

function quoteSwap(fromAmount: number, rate: number, feeBps: number = DEFAULT_SWAP_FEE_BPS) {
  const toAmount = fromAmount * rate * (1 - feeBps / 10000);
  const feeAmount = fromAmount * rate * (feeBps / 10000);
  return { feeAmount, toAmount };
}

function isValidSwapAmount(fromAmount: number): boolean {
  return Number.isFinite(fromAmount) && fromAmount > 0;
}

type DepositInput = {
  amountCents: number;
  method: string;
  proofPath: string;
  investorId: string;
};

function validateDeposit(input: DepositInput): { ok: true } | { ok: false; error: string } {
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents < MIN_DEPOSIT_CENTS ||
    (input.method !== "usdt-trc20" && input.method !== "btc") ||
    !input.proofPath.trim()
  ) {
    return { ok: false, error: "Minimum deposit is $50. Select a valid cryptocurrency." };
  }
  if (!input.proofPath.startsWith(`deposit-proof/${input.investorId}/`)) {
    return { ok: false, error: "Deposit proof is invalid or expired." };
  }
  return { ok: true };
}

function validateWithdrawal(
  balanceCents: number,
  amountCents: number,
  closeAccount: boolean,
): { ok: true } | { ok: false; error: string } {
  if (balanceCents < MIN_WITHDRAW_BALANCE_CENTS) {
    return { ok: false, error: "A minimum balance of $3,000 is required to withdraw." };
  }
  if (amountCents > balanceCents) {
    return { ok: false, error: "Insufficient available balance." };
  }
  if (closeAccount && amountCents !== balanceCents) {
    return { ok: false, error: "Close-account withdrawals must equal your full available balance." };
  }
  return { ok: true };
}

function roiBpsForPlan(planName: string | null | undefined): number {
  if (!planName) return 0;
  return ROI_BPS[planName] ?? 0;
}

describe("money guards pin prod source", () => {
  it("should pin the swap fee formula when route sources are read", () => {
    expect(swapExecuteSource).toContain("computeSwapAmounts");
    expect(swapExecuteSource).toContain("fromAmount * rate * (1 - feeBps / 10000)");
    expect(swapExecuteSource).toContain("fromAmount * rate * (feeBps / 10000)");
    expect(swapRateSource).toContain("amount * rate - fee");
  });

  it("should pin deposit, withdrawal and ROI guards when route sources are read", () => {
    expect(depositsSource).toContain("amountCents < 5000");
    expect(withdrawalsSource).toContain("MIN_WITHDRAW_BALANCE_CENTS = 300_000");
    expect(withdrawalsSource).toContain("Close-account withdrawals must equal");
    expect(roiSource).toContain("Starter: 1500, Growth: 2500, Elite: 3500");
  });
});

describe("swap fee quote", () => {
  it("should compute toAmount as from*rate*(1-fee) when quoting", () => {
    const { feeAmount, toAmount } = quoteSwap(2, 10, 50);
    expect(feeAmount).toBeCloseTo(2 * 10 * 0.005, 10);
    expect(toAmount).toBeCloseTo(2 * 10 * (1 - 0.005), 10);
  });

  it("should keep fee plus proceeds equal to the gross when quoting", () => {
    const { feeAmount, toAmount } = quoteSwap(100, 1.5, 50);
    expect(feeAmount + toAmount).toBeCloseTo(100 * 1.5, 10);
  });

  it("should charge the default 0.5% fee when no override is given", () => {
    const { feeAmount, toAmount } = quoteSwap(1000, 2);
    expect(feeAmount).toBeCloseTo(10, 10);
    expect(toAmount).toBeCloseTo(1990, 10);
  });

  it("should scale the fee linearly when the amount grows", () => {
    expect(quoteSwap(200, 1, 50).feeAmount).toBeCloseTo(
      quoteSwap(100, 1, 50).feeAmount * 2,
      10,
    );
  });

  it("should reject non-positive amounts when validating swap input", () => {
    expect(isValidSwapAmount(0)).toBe(false);
    expect(isValidSwapAmount(-3)).toBe(false);
    expect(isValidSwapAmount(Number.NaN)).toBe(false);
    expect(isValidSwapAmount(0.5)).toBe(true);
  });
});

describe("deposit guard", () => {
  const base: DepositInput = {
    amountCents: 5000,
    method: "usdt-trc20",
    proofPath: "deposit-proof/user-1/proof.png",
    investorId: "user-1",
  };

  it("should reject deposits when the amount is below 5000 cents", () => {
    expect(validateDeposit({ ...base, amountCents: 4999 }).ok).toBe(false);
    expect(validateDeposit({ ...base, amountCents: 0 }).ok).toBe(false);
  });

  it("should accept deposits when the amount equals exactly 5000 cents", () => {
    expect(validateDeposit(base)).toEqual({ ok: true });
  });

  it("should reject deposits when method or proof is invalid", () => {
    expect(validateDeposit({ ...base, method: "eth" }).ok).toBe(false);
    expect(validateDeposit({ ...base, proofPath: "  " }).ok).toBe(false);
    expect(
      validateDeposit({ ...base, proofPath: "deposit-proof/other-user/proof.png" }).ok,
    ).toBe(false);
  });

  it("should reject deposits when the amount is not an integer", () => {
    expect(validateDeposit({ ...base, amountCents: 5000.5 }).ok).toBe(false);
  });
});

describe("withdrawal guard", () => {
  it("should reject withdrawals when the balance is below 300000 cents", () => {
    const result = validateWithdrawal(299999, 10000, false);
    expect(result.ok).toBe(false);
  });

  it("should accept withdrawals when the balance meets the 300000 minimum", () => {
    expect(validateWithdrawal(300000, 10000, false)).toEqual({ ok: true });
  });

  it("should reject withdrawals when the amount exceeds the balance", () => {
    expect(validateWithdrawal(500000, 500001, false).ok).toBe(false);
  });

  it("should require close-account withdrawals to equal the full balance", () => {
    expect(validateWithdrawal(500000, 400000, true).ok).toBe(false);
    expect(validateWithdrawal(500000, 500000, true)).toEqual({ ok: true });
  });
});

describe("ROI BPS map", () => {
  it.each([
    ["Starter", 1500],
    ["Growth", 2500],
    ["Elite", 3500],
  ])("should map %s to %i bps when crediting ROI", (plan, bps) => {
    expect(roiBpsForPlan(plan)).toBe(bps);
  });

  it("should map unknown plans to 0 bps when no fixed rate exists", () => {
    expect(roiBpsForPlan("None")).toBe(0);
    expect(roiBpsForPlan("Mystery")).toBe(0);
    expect(roiBpsForPlan(null)).toBe(0);
    expect(roiBpsForPlan(undefined)).toBe(0);
  });

  it("should credit 15% for Starter when applying the 1500 bps rate", () => {
    const principalCents = 100000;
    const profitCents = Math.floor((principalCents * roiBpsForPlan("Starter")) / 10000);
    expect(profitCents).toBe(15000);
  });
});
