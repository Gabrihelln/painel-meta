import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "painel_sessao";

function secret(): string {
  return process.env.AUTH_SECRET || process.env.PAINEL_SENHA || "modo-demo";
}

export function passwordRequired(): boolean {
  return Boolean(process.env.PAINEL_SENHA);
}

export function sessionToken(): string {
  return createHmac("sha256", secret()).update("painel:" + (process.env.PAINEL_SENHA ?? "")).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function isValidSession(value: string | undefined): boolean {
  if (!passwordRequired()) return true;
  return Boolean(value) && safeEqual(value!, sessionToken());
}

/** Confere um token vindo em header (aceita "Bearer xxx" ou só "xxx"). */
export function checkHeaderToken(header: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!header) return false;
  const value = header.replace(/^Bearer\s+/i, "").trim();
  return safeEqual(value, expected.trim());
}
