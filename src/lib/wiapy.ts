import type { Sale } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Extrai o id do anúncio do Meta de uma UTM.
 * Aceita `{{ad.id}}` puro ("120212345678900123") ou formatos como
 * "Nome do anúncio|120212345678900123" / "nome_120212345678900123".
 */
export function extractAdId(utmContent: string | null | undefined): string | null {
  if (!utmContent) return null;
  const v = String(utmContent).trim();
  if (/^\d{6,}$/.test(v)) return v;
  const matches = v.match(/\d{10,}/g);
  return matches ? matches[matches.length - 1] : null;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function cents(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export type ParseResult =
  | { kind: "sale"; sale: Sale }
  | { kind: "ignored"; reason: string };

/** Converte o JSON do webhook da Wiapy em uma linha da tabela `sales`. */
export function parseWiapyPayload(body: any): ParseResult {
  if (!body || typeof body !== "object") return { kind: "ignored", reason: "corpo vazio" };
  const p = body.payment;
  if (!p || typeof p !== "object") {
    return { kind: "ignored", reason: "carrinho abandonado (sem pagamento)" };
  }
  const id = str(p.id);
  if (!id) return { kind: "ignored", reason: "pagamento sem id" };

  const t = body.tracking ?? {};
  const bumps: any[] = Array.isArray(body.checkout?.orderbump) ? body.checkout.orderbump : [];
  const products: any[] = Array.isArray(body.products) ? body.products : [];
  const now = new Date().toISOString();
  const created = str(p.dt_create) ?? now;

  const sale: Sale = {
    id,
    status: str(p.status) ?? "unpaid",
    payment_method: str(p.payment_method),
    payment_type: str(p.type),
    amount_cents: cents(p.amount),
    fee_cents: cents(p.fee),
    orderbump_cents: bumps.reduce((s, b) => s + cents(b?.amount), 0),
    created_at: created,
    updated_at: str(p.dt_update) ?? created,
    customer_name: str(body.customer?.name),
    customer_email: str(body.customer?.email),
    checkout_id: str(body.checkout?.id),
    checkout_title: str(body.checkout?.title),
    product_titles: products.map((x) => str(x?.title)).filter(Boolean).join(", ") || null,
    utm_source: str(t.utm_source),
    utm_medium: str(t.utm_medium),
    utm_campaign: str(t.utm_campaign),
    utm_content: str(t.utm_content),
    utm_term: str(t.utm_term),
    ad_id: extractAdId(t.utm_content) ?? extractAdId(t.utm_term),
    fbc: str(t.fbc),
    fbp: str(t.fbp),
  };
  return { kind: "sale", sale };
}

export const STATUS_LABEL: Record<string, string> = {
  paid: "Pago",
  unpaid: "Aguardando",
  credit_card_declined: "Cartão recusado",
  refunded: "Reembolsado",
  chargedback: "Chargeback",
};

export const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  credit_card: "cartão",
  boleto: "boleto",
};
