import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "painel_sessao";

/** Remove espaços e aspas em volta (comum ao colar valores na Vercel). */
export function cleanSecret(raw: string | null | undefined): string {
  return (raw ?? "").normalize("NFC").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

export function panelPassword(): string {
  return cleanSecret(process.env.PAINEL_SENHA);
}

function secret(): string {
  return cleanSecret(process.env.AUTH_SECRET) || panelPassword() || "modo-demo";
}

export function passwordRequired(): boolean {
  return Boolean(panelPassword());
}

export function sessionToken(): string {
  return createHmac("sha256", secret()).update("painel:" + panelPassword()).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Confere a senha digitada na tela de login. */
export function checkPassword(typed: string): boolean {
  const expected = panelPassword();
  return Boolean(expected) && safeEqual(cleanSecret(typed), expected);
}

export function isValidSession(value: string | undefined): boolean {
  if (!passwordRequired()) return true;
  return Boolean(value) && safeEqual(value!, sessionToken());
}

/** Confere um token vindo em header (aceita "Bearer xxx" ou só "xxx"). */
export function checkHeaderToken(header: string | null, expected: string | undefined): boolean {
  const exp = cleanSecret(expected);
  if (!exp || !header) return false;
  return safeEqual(cleanSecret(header.replace(/^\s*Bearer\s+/i, "")), exp);
}
