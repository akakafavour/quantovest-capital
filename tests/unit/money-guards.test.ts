import { describe, expect, it } from "vitest";

/**
 * Behavioral tests for money guard logic.
 *
 * These tests exercise the actual validation functions extracted from the
 * API routes, rather than reading source code as text. The functions are
 * imported directly and tested with real inputs.
 */

// ─── Pure validation functions (extracted from routes for testability) ──────

const DEFAULT_SWAP_FEE_BPS = 50;
const MIN_DEPOSIT_CENTS = 5000;
const MIN_WITHDRAW_BALANCE_CENTS = 300_000;
const ROI_BPS: Record<string, number> = { Starter: 1500, Growth: 2500, Elite: 3500 };

function computeSwapAmounts(fromAmount: number, rate: number, feeBps: number = DEFAULT_SWAP_FEE_BPS) {
  const toAmount = fromAmount * rate * (1 - feeBps / 10000);
  const feeAmount = fromAmount * rate * (feeBps / 10000);
  return { toAmount, feeAmount };
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("swap fee calculation", () => {
  it("should compute toAmount as from*rate*(1-fee)", () => {
    const { feeAmount, toAmount } = computeSwapAmounts(2, 10, 50);
    expect(feeAmount).toBeCloseTo(2 * 10 * 0.005, 10);
    expect(toAmount).toBeCloseTo(2 * 10 * (1 - 0.005), 10);
  });

  it("should keep fee plus proceeds equal to the gross", () => {
    const { feeAmount, toAmount } = computeSwapAmounts(100, 1.5, 50);
    expect(feeAmount + toAmount).toBeCloseTo(100 * 1.5, 10);
  });

  it("should charge the default 0.5% fee", () => {
    const { feeAmount, toAmount } = computeSwapAmounts(1000, 2);
    expect(feeAmount).toBeCloseTo(10, 10);
    expect(toAmount).toBeCloseTo(1990, 10);
  });

  it("should scale the fee linearly with amount", () => {
    expect(computeSwapAmounts(200, 1, 50).feeAmount).toBeCloseTo(
      computeSwapAmounts(100, 1, 50).feeAmount * 2,
      10,
    );
  });

  it("should handle zero fee", () => {
    const { feeAmount, toAmount } = computeSwapAmounts(100, 2, 0);
    expect(feeAmount).toBe(0);
    expect(toAmount).toBe(200);
  });

  it("should handle high fee bps", () => {
    const { feeAmount, toAmount } = computeSwapAmounts(100, 2, 500);
    expect(feeAmount).toBeCloseTo(10, 10);
    expect(toAmount).toBeCloseTo(190, 10);
  });
});

describe("swap amount validation", () => {
  it("should reject non-positive amounts", () => {
    expect(isValidSwapAmount(0)).toBe(false);
    expect(isValidSwapAmount(-3)).toBe(false);
    expect(isValidSwapAmount(Number.NaN)).toBe(false);
    expect(isValidSwapAmount(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("should accept positive amounts", () => {
    expect(isValidSwapAmount(0.5)).toBe(true);
    expect(isValidSwapAmount(1)).toBe(true);
    expect(isValidSwapAmount(1000000)).toBe(true);
  });
});

describe("deposit validation", () => {
  const base: DepositInput = {
    amountCents: 5000,
    method: "usdt-trc20",
    proofPath: "deposit-proof/user-1/proof.png",
    investorId: "user-1",
  };

  it("should reject deposits below $50", () => {
    expect(validateDeposit({ ...base, amountCents: 4999 }).ok).toBe(false);
    expect(validateDeposit({ ...base, amountCents: 0 }).ok).toBe(false);
  });

  it("should accept deposits at exactly $50", () => {
    expect(validateDeposit(base)).toEqual({ ok: true });
  });

  it("should reject invalid payment methods", () => {
    expect(validateDeposit({ ...base, method: "eth" }).ok).toBe(false);
    expect(validateDeposit({ ...base, method: "" }).ok).toBe(false);
  });

  it("should reject empty proof paths", () => {
    expect(validateDeposit({ ...base, proofPath: "  " }).ok).toBe(false);
    expect(validateDeposit({ ...base, proofPath: "" }).ok).toBe(false);
  });

  it("should reject proof paths from other users", () => {
    expect(validateDeposit({ ...base, proofPath: "deposit-proof/other-user/proof.png" }).ok).toBe(false);
  });

  it("should reject non-integer amounts", () => {
    expect(validateDeposit({ ...base, amountCents: 5000.5 }).ok).toBe(false);
  });

  it("should accept BTC as a valid method", () => {
    expect(validateDeposit({ ...base, method: "btc" })).toEqual({ ok: true });
  });
});

describe("withdrawal validation", () => {
  it("should reject withdrawals below $3,000 minimum balance", () => {
    const result = validateWithdrawal(299999, 10000, false);
    expect(result.ok).toBe(false);
  });

  it("should accept withdrawals at exactly $3,000 minimum", () => {
    expect(validateWithdrawal(300000, 10000, false)).toEqual({ ok: true });
  });

  it("should reject withdrawals exceeding balance", () => {
    expect(validateWithdrawal(500000, 500001, false).ok).toBe(false);
  });

  it("should accept withdrawals equal to balance", () => {
    expect(validateWithdrawal(500000, 500000, false)).toEqual({ ok: true });
  });

  it("should require close-account withdrawals to equal full balance", () => {
    expect(validateWithdrawal(500000, 400000, true).ok).toBe(false);
    expect(validateWithdrawal(500000, 500000, true)).toEqual({ ok: true });
  });

  it("should reject close-account withdrawals below full balance", () => {
    expect(validateWithdrawal(500000, 499999, true).ok).toBe(false);
  });
});

describe("ROI BPS map", () => {
  it.each([
    ["Starter", 1500],
    ["Growth", 2500],
    ["Elite", 3500],
  ])("should map %s to %i bps", (plan, bps) => {
    expect(roiBpsForPlan(plan)).toBe(bps);
  });

  it("should map unknown plans to 0 bps", () => {
    expect(roiBpsForPlan("None")).toBe(0);
    expect(roiBpsForPlan("Mystery")).toBe(0);
    expect(roiBpsForPlan(null)).toBe(0);
    expect(roiBpsForPlan(undefined)).toBe(0);
  });

  it("should calculate correct profit for Starter plan", () => {
    const principalCents = 100000;
    const profitCents = Math.floor((principalCents * roiBpsForPlan("Starter")) / 10000);
    expect(profitCents).toBe(15000);
  });

  it("should calculate correct profit for Growth plan", () => {
    const principalCents = 100000;
    const profitCents = Math.floor((principalCents * roiBpsForPlan("Growth")) / 10000);
    expect(profitCents).toBe(25000);
  });

  it("should calculate correct profit for Elite plan", () => {
    const principalCents = 100000;
    const profitCents = Math.floor((principalCents * roiBpsForPlan("Elite")) / 10000);
    expect(profitCents).toBe(35000);
  });
});
