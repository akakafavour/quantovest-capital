const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function encodeBase32(bytes: Uint8Array): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function decodeBase32(secret: string): Uint8Array {
  const cleaned = secret.replace(/[\s=]/g, '').toUpperCase();
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

function counterToBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    bytes[i] = temp & 255;
    temp = Math.floor(temp / 256);
  }
  return bytes;
}

async function hmacSHA1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const keyBuf = new Uint8Array(key).buffer as ArrayBuffer;
  const dataBuf = new Uint8Array(data).buffer as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuf,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, dataBuf);
  return new Uint8Array(sig);
}

function dynamicTruncate(hmac: Uint8Array): number {
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return binary % 1000000;
}

export function generateSecret(length = 20): string {
  const bytes = new Uint8Array(length);
  // Fail closed: never fall back to Math.random() (predictable). Web Crypto
  // is available in all supported browsers, Node 18+, and Edge runtimes.
  if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
    throw new Error('Secure random number generator is unavailable in this environment.');
  }
  crypto.getRandomValues(bytes);
  return encodeBase32(bytes);
}

/**
 * Build the otpauth:// URI for a TOTP secret (does NOT render an image).
 */
export function getTotpUri(email: string, secret: string): string {
  const issuer = 'Quantovest';
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

/**
 * @deprecated SECURITY: renders the QR by sending the otpauth URI (which
 * contains the raw TOTP secret) to a third-party image API off-origin. Any
 * secret passed here leaks to that origin's logs. Kept only for backward
 * compat — new UI must render the QR code CLIENT-SIDE from `getTotpUri()`
 * output (e.g. a canvas QR renderer bundled with the app) so the secret
 * never leaves the user's browser. See components/totp-qr.tsx.
 */
export function getQRCodeUrl(email: string, secret: string): string {
  const otpauth = getTotpUri(email, secret);
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauth)}`;
}

export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) return false;
  if (!secret || secret.length < 8) return false;

  const keyBytes = decodeBase32(secret);
  const timeStep = Math.floor(Date.now() / 30000);

  for (let offset = -1; offset <= 1; offset++) {
    const counter = timeStep + offset;
    const counterBytes = counterToBytes(counter);
    const hmac = await hmacSHA1(keyBytes, counterBytes);
    if (dynamicTruncate(hmac) === parseInt(code, 10)) return true;
  }
  return false;
}
