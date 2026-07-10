/**
 * Single-user session, signed cookie only — the pattern proven on
 * greyform.org/admin, with one difference: the HMAC uses Web Crypto instead
 * of node:crypto so the SAME verification runs in Edge middleware (the gate
 * for every page and API route) and in Node route handlers (login/logout).
 *
 * Token format: `<ts>.<hex-hmac>` keyed by STUDIO_PASSWORD. Forging requires
 * the password; expiry is encoded in the token; logout = clear cookie.
 * Rotating the password invalidates every outstanding session.
 */

export const COOKIE_NAME = "gf_studio";
export const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — it's your own tool

function getPassword(): string | null {
  return process.env.STUDIO_PASSWORD || null;
}

async function hmacHex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(submitted: string): Promise<boolean> {
  const expected = getPassword();
  if (!expected) return false;
  if (typeof submitted !== "string" || submitted.length === 0) return false;
  // Compare HMACs of the two values so length isn't leaked by safeEqual.
  const [a, b] = await Promise.all([
    hmacHex(submitted, expected),
    hmacHex(expected, expected),
  ]);
  return safeEqual(a, b);
}

export async function issueToken(): Promise<string | null> {
  const pwd = getPassword();
  if (!pwd) return null;
  const ts = Date.now().toString();
  return `${ts}.${await hmacHex(ts, pwd)}`;
}

export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const pwd = getPassword();
  if (!pwd) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return false;
  const tsStr = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const ts = Number(tsStr);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const ageMs = Date.now() - ts;
  if (ageMs < 0 || ageMs > MAX_AGE_SECONDS * 1000) return false;
  const expected = await hmacHex(tsStr, pwd);
  return safeEqual(mac, expected);
}
