"use server";

import { redirect } from "next/navigation";
import { isDemo, storePagesData, storeSettings } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { syncMeta } from "@/lib/sync";

function n(v: FormDataEntryValue | null, fallback: number): number {
  const x = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(x) ? x : fallback;
}

export async function saveSettingsAction(formData: FormData) {
  await requireSession();
  try {
    await storeSettings({
    tax_percent: Math.min(100, Math.max(0, n(formData.get("tax_percent"), 0))),
    ad_tax_percent: Math.min(100, Math.max(0, n(formData.get("ad_tax_percent"), 0))),
    fixed_cost_per_sale_cents: Math.max(0, Math.round(n(formData.get("fixed_cost"), 0) * 100)),
    min_spend_to_judge: Math.max(0, n(formData.get("min_spend_to_judge"), 100)),
    roi_pause: n(formData.get("roi_pause"), 0),
    roi_attention: n(formData.get("roi_attention"), 50),
    roi_scale: n(formData.get("roi_scale"), 150),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // banco criado antes do campo novo: falta rodar a atualização do supabase/schema.sql
    redirect(/ad_tax_percent/.test(msg) ? "/configuracoes?erro=migracao" : "/configuracoes?erro=salvar");
  }
  redirect("/configuracoes?salvo=1");
}

export async function syncNowAction(formData: FormData) {
  await requireSession();
  if (isDemo()) redirect("/configuracoes?sync=demo");
  const dias = n(formData.get("dias"), 7);
  const r = await syncMeta(dias);
  redirect(r.ok ? `/configuracoes?sync=ok&n=${r.insights}` : `/configuracoes?sync=erro`);
}

/** Salva nomes das páginas, junções e ligação produto → página. */
export async function savePagesAction(formData: FormData) {
  await requireSession();
  const pages: { key: string; name: string | null; merge_into: string | null }[] = [];
  const productPages: { product: string; page_key: string }[] = [];
  const cleared: string[] = [];
  for (let i = 0; formData.has(`page_key_${i}`); i++) {
    const key = String(formData.get(`page_key_${i}`));
    const name = String(formData.get(`page_name_${i}`) ?? "").trim() || null;
    const merge = String(formData.get(`page_merge_${i}`) ?? "").trim();
    pages.push({ key, name, merge_into: merge && merge !== key ? merge : null });
  }
  for (let i = 0; formData.has(`prod_${i}`); i++) {
    const product = String(formData.get(`prod_${i}`));
    const page = String(formData.get(`prod_page_${i}`) ?? "").trim();
    if (page) productPages.push({ product, page_key: page });
    else cleared.push(product);
  }
  try {
    await storePagesData(pages, productPages, cleared);
  } catch (e) {
    console.error("salvar páginas:", e);
    redirect("/configuracoes?erro=paginas#paginas");
  }
  redirect("/configuracoes?paginas=1#paginas");
}
