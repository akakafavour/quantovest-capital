import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTwoFactorToken, verifyTwoFactorToken } from "@/lib/2fa-session";
import { generateSecret, verifyTOTP } from "@/lib/totp";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TEST_JWT_SECRET = "test-only-jwt-secret-that-is-long-enough-1234567890";

/** Independent test-oracle HOTP implementation (mirrors RFC 4226, not lib internals). */
function decodeBase32ForTest(secret: string): Uint8Array {
  const cleaned = secret.replace(/[\s=]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_CHARS.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function hotpForTest(secret: string, counter: number): Promise<string> {
  const keyBytes = decodeBase32ForTest(secret);
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 255;
    temp = Math.floor(temp / 256);
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyBytes).buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new Uint8Array(counterBytes).buffer as ArrayBuffer),
  );
  const offset = sig[sig.length - 1] & 0x0f;
  const binary =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, "0");
}

async function totpCodeAtOffset(secret: string, offsetSteps: number): Promise<string> {
  const step = Math.floor(Date.now() / 30000) + offsetSteps;
  return hotpForTest(secret, step);
}

describe("verifyTOTP", () => {
  const secret = generateSecret();

  it("should accept the current code when clocks agree", async () => {
    const code = await totpCodeAtOffset(secret, 0);
    await expect(verifyTOTP(secret, code)).resolves.toBe(true);
  });

  it("should accept the previous step code when the clock skews -1", async () => {
    const code = await totpCodeAtOffset(secret, -1);
    await expect(verifyTOTP(secret, code)).resolves.toBe(true);
  });

  it("should accept the next step code when the clock skews +1", async () => {
    const code = await totpCodeAtOffset(secret, 1);
    await expect(verifyTOTP(secret, code)).resolves.toBe(true);
  });

  it("should reject a code far outside the window when drift is large", async () => {
    // ±5 steps stays outside the ±1 window even if a 30s boundary rolls over mid-test.
    const farPast = await totpCodeAtOffset(secret, -5);
    const farFuture = await totpCodeAtOffset(secret, 5);
    await expect(verifyTOTP(secret, farPast)).resolves.toBe(false);
    await expect(verifyTOTP(secret, farFuture)).resolves.toBe(false);
  });

  it("should reject an incorrect code when the guess does not match", async () => {
    const current = await totpCodeAtOffset(secret, 0);
    const wrong = current === "123456" ? "654321" : "123456";
    await expect(verifyTOTP(secret, wrong)).resolves.toBe(false);
  });

  it("should reject malformed codes when format is invalid", async () => {
    await expect(verifyTOTP(secret, "")).resolves.toBe(false);
    await expect(verifyTOTP(secret, "12345")).resolves.toBe(false);
    await expect(verifyTOTP(secret, "1234567")).resolves.toBe(false);
    await expect(verifyTOTP(secret, "abcdef")).resolves.toBe(false);
    await expect(verifyTOTP(secret, "12 456")).resolves.toBe(false);
  });

  it("should reject verification when the secret is too short", async () => {
    await expect(verifyTOTP("ABC", "123456")).resolves.toBe(false);
    await expect(verifyTOTP("", "123456")).resolves.toBe(false);
  });
});

describe("createTwoFactorToken / verifyTwoFactorToken", () => {
  let savedSecret: string | undefined;

  beforeEach(() => {
    savedSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = savedSecret;
  });

  it("should verify a fresh token when user and signature match", async () => {
    const token = await createTwoFactorToken("user-1");
    await expect(verifyTwoFactorToken(token, "user-1")).resolves.toBe(true);
  });

  it("should reject the token when the user id differs", async () => {
    const token = await createTwoFactorToken("user-1");
    await expect(verifyTwoFactorToken(token, "user-2")).resolves.toBe(false);
  });

  it("should reject the token when the signature is tampered", async () => {
    const token = await createTwoFactorToken("user-1");
    const parts = token.split(".");
    const last = parts[2].slice(-1);
    const tamperedSig = parts[2].slice(0, -1) + (last === "A" ? "B" : "A");
    await expect(
      verifyTwoFactorToken(`${parts[0]}.${parts[1]}.${tamperedSig}`, "user-1"),
    ).resolves.toBe(false);
  });

  it("should reject the token when the expiry is tampered", async () => {
    const token = await createTwoFactorToken("user-1");
    const parts = token.split(".");
    const extended = `${parts[0]}.${String(Number(parts[1]) + 99999)}.${parts[2]}`;
    await expect(verifyTwoFactorToken(extended, "user-1")).resolves.toBe(false);
  });

  it("should reject the token when it has expired", async () => {
    const expired = await createTwoFactorToken("user-1", -60);
    await expect(verifyTwoFactorToken(expired, "user-1")).resolves.toBe(false);
  });

  it("should reject malformed tokens when structure is invalid", async () => {
    await expect(verifyTwoFactorToken(undefined, "user-1")).resolves.toBe(false);
    await expect(verifyTwoFactorToken("", "user-1")).resolves.toBe(false);
    await expect(verifyTwoFactorToken("only-two.parts", "user-1")).resolves.toBe(false);
    await expect(verifyTwoFactorToken("user-1.not-a-number.sig", "user-1")).resolves.toBe(false);
  });

  it("should throw when creating a token with a short secret", async () => {
    process.env.JWT_SECRET = "too-short";
    await expect(createTwoFactorToken("user-1")).rejects.toThrow();
  });

  it("should throw when verifying a token with a short secret", async () => {
    const token = await createTwoFactorToken("user-1");
    process.env.JWT_SECRET = "too-short";
    await expect(verifyTwoFactorToken(token, "user-1")).rejects.toThrow();
  });

  it("should throw when the signing secret is missing", async () => {
    delete process.env.JWT_SECRET;
    await expect(createTwoFactorToken("user-1")).rejects.toThrow();
  });
});
