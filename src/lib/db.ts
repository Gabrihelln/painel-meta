import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdInfo, AdInsight, Sale, Settings } from "./types";
import { DEFAULT_SETTINGS } from "./types";
import type { PageInfo, ProductPage } from "./pages";
import { addDays, startOfLocalDayUtc } from "./period";

let client: SupabaseClient | null = null;

export function isDemo(): boolean {
  return process.env.DEMO_MODE === "1" || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/**
 * Aceita "https://xxx.supabase.co", com "/rest/v1" ou barra no final,
 * ou o link do painel "https://supabase.com/dashboard/project/xxx".
 */
export function normalizeSupabaseUrl(raw: string | undefined): string {
  const v = (raw ?? "").trim().replace(/^["'`]+|["'`]+$/g, "");
  if (!v) return "";
  const dash = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return `https://${dash[1]}.supabase.co`;
  try {
    return new URL(v.includes("://") ? v : `https://${v}`).origin;
  } catch {
    return v;
  }
}

export function db(): SupabaseClient {
  if (!client) {
    const url = normalizeSupabaseUrl(process.env.SUPABASE_URL);
    const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim().replace(/^["'`]+|["'`]+$/g, "");
    if (!url || !key) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY não configurados");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

const PAGE = 1000;
const SALE_COLUMNS =
  "id,status,payment_method,payment_type,amount_cents,fee_cents,orderbump_cents,created_at,updated_at,customer_name,customer_email,checkout_id,checkout_title,product_titles,utm_source,utm_medium,utm_campaign,utm_content,utm_term,ad_id,fbc,fbp,received_at";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function selectAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function getSales(since: string, until: string): Promise<Sale[]> {
  const start = startOfLocalDayUtc(since);
  const end = startOfLocalDayUtc(addDays(until, 1));
  return selectAll<Sale>((a, b) =>
    db().from("sales").select(SALE_COLUMNS).gte("created_at", start).lt("created_at", end)
      .order("created_at", { ascending: false }).range(a, b),
  );
}

export async function getInsights(since: string, until: string): Promise<AdInsight[]> {
  const rows = await selectAll<AdInsight>((a, b) =>
    db().from("ad_insights").select("*").gte("date", since).lte("date", until)
      .order("date").order("ad_id").range(a, b),
  );
  return rows.map((r) => ({ ...r, spend: Number(r.spend) }));
}

export async function getAds(): Promise<AdInfo[]> {
  return selectAll<AdInfo>((a, b) => db().from("ads").select("*").order("ad_id").range(a, b));
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await db().from("settings").select("*").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!data) return DEFAULT_SETTINGS;
  return {
    tax_percent: Number(data.tax_percent),
    ad_tax_percent: Number(data.ad_tax_percent ?? 0),
    fixed_cost_per_sale_cents: Number(data.fixed_cost_per_sale_cents),
    min_spend_to_judge: Number(data.min_spend_to_judge),
    roi_pause: Number(data.roi_pause),
    roi_attention: Number(data.roi_attention),
    roi_scale: Number(data.roi_scale),
    last_meta_sync_at: data.last_meta_sync_at,
    last_meta_sync_error: data.last_meta_sync_error,
  };
}

export async function saveSettings(s: Partial<Settings>) {
  const { error } = await db().from("settings").upsert({ id: 1, ...s });
  if (error) throw new Error(`Supabase: ${error.message}`);
}

/** Grava a venda, sem deixar um aviso antigo sobrescrever um mais novo. */
export async function upsertSale(sale: Sale, raw: unknown): Promise<"inserted" | "updated" | "stale"> {
  const { data: existing, error: e1 } = await db().from("sales").select("updated_at").eq("id", sale.id).maybeSingle();
  if (e1) throw new Error(`Supabase: ${e1.message}`);
  if (existing && Date.parse(existing.updated_at) > Date.parse(sale.updated_at)) return "stale";
  const { error } = await db().from("sales").upsert({ ...sale, raw, received_at: new Date().toISOString() });
  if (error) throw new Error(`Supabase: ${error.message}`);
  return existing ? "updated" : "inserted";
}

export async function upsertInsights(rows: AdInsight[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => ({ ...r, updated_at: new Date().toISOString() }));
    const { error } = await db().from("ad_insights").upsert(chunk, { onConflict: "date,ad_id" });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
}

export async function upsertAds(rows: AdInfo[]) {
  let withLink = true;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500).map((r) => {
      const row: Record<string, unknown> = { ...r, updated_at: new Date().toISOString() };
      if (!withLink) delete row.link_url;
      return row;
    });
    let { error } = await db().from("ads").upsert(chunk, { onConflict: "ad_id" });
    if (error && /link_url/.test(error.message)) {
      // banco ainda sem a coluna link_url (falta rodar a atualização do schema.sql): grava sem ela
      withLink = false;
      chunk.forEach((r) => delete r.link_url);
      ({ error } = await db().from("ads").upsert(chunk, { onConflict: "ad_id" }));
    }
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
}

// ---------- páginas de venda ----------

export interface PagesData {
  pages: PageInfo[];
  productPages: ProductPage[];
  /** true quando as tabelas novas ainda não existem no banco. */
  needsMigration: boolean;
}

export async function getPagesData(): Promise<PagesData> {
  const [p, pp] = await Promise.all([
    db().from("pages").select("key,name,merge_into"),
    db().from("product_pages").select("product,page_key"),
  ]);
  const missing = (e: { message: string } | null) => Boolean(e && /pages|relation|schema cache|does not exist/i.test(e.message));
  if (missing(p.error) || missing(pp.error)) return { pages: [], productPages: [], needsMigration: true };
  if (p.error) throw new Error(`Supabase: ${p.error.message}`);
  if (pp.error) throw new Error(`Supabase: ${pp.error.message}`);
  return { pages: p.data ?? [], productPages: pp.data ?? [], needsMigration: false };
}

export async function savePagesData(pages: PageInfo[], productPages: ProductPage[], clearedProducts: string[]) {
  if (pages.length) {
    const { error } = await db().from("pages").upsert(pages, { onConflict: "key" });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
  if (productPages.length) {
    const { error } = await db().from("product_pages").upsert(productPages, { onConflict: "product" });
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
  if (clearedProducts.length) {
    const { error } = await db().from("product_pages").delete().in("product", clearedProducts);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
}

/** Nomes de produtos que já apareceram nas vendas (para ligar produto → página). */
export async function getProductNames(): Promise<string[]> {
  const names = new Set<string>();
  const rows = await selectAll<{ checkout_title: string | null; product_titles: string | null }>((a, b) =>
    db().from("sales").select("checkout_title,product_titles").range(a, b),
  );
  for (const r of rows) {
    const n = r.checkout_title ?? r.product_titles;
    if (n) names.add(n);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export async function utmCoverage(since: string, until: string): Promise<{ total: number; tracked: number; lastSaleAt: string | null }> {
  const sales = await getSales(since, until);
  const paid = sales.filter((s) => s.status === "paid");
  return {
    total: paid.length,
    tracked: paid.filter((s) => s.ad_id).length,
    lastSaleAt: sales[0]?.received_at ?? sales[0]?.created_at ?? null,
  };
}
