// Páginas de venda: agrupa anúncios (pelo link de destino) e vendas (pela UTM ou pelo produto).
import type { AdInfo, AdInsight, Sale, Settings } from "./types";
import { addInsight, addSale, derive, emptyTotals, finish, situation, type Derived, type Situation, type Totals } from "./metrics";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const NO_PAGE = "__sem_pagina__";

export interface PageInfo {
  key: string; // endereço normalizado (ex.: "meusite.com/decisoes")
  name: string | null;
  merge_into: string | null; // junta esta página com outra
}

export interface ProductPage {
  product: string;
  page_key: string;
}

/**
 * Normaliza o link de destino para agrupar: sem https, sem www, sem parâmetros (UTMs) e sem barra final.
 * "https://www.MeuSite.com/decisoes/?utm_source=x" → "meusite.com/decisoes"
 */
export function normalizePageUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;
  try {
    const u = new URL(v.includes("://") ? v : `https://${v}`);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = decodeURI(u.pathname).replace(/\/+$/, "");
    return host + path;
  } catch {
    return null;
  }
}

/** Procura o link de destino nos vários formatos de criativo do Meta. */
export function extractCreativeLink(c: any): string | null {
  if (!c || typeof c !== "object") return null;
  const s = c.object_story_spec ?? {};
  const candidates = [
    c.link_url,
    s.link_data?.link,
    s.link_data?.call_to_action?.value?.link,
    s.video_data?.call_to_action?.value?.link,
    s.template_data?.link,
    s.link_data?.child_attachments?.[0]?.link,
    c.asset_feed_spec?.link_urls?.[0]?.website_url,
  ];
  for (const x of candidates) {
    if (typeof x === "string" && /^https?:\/\//i.test(x) && !/facebook\.com|fb\.me|instagram\.com/i.test(x)) return x;
  }
  return null;
}

/** Mostra o endereço de forma curta. */
export function prettyUrl(key: string): string {
  return key === NO_PAGE ? "anúncios sem link ou vendas sem UTM" : key;
}

export interface PageResolver {
  ofAd(adId: string | null | undefined): string;
  ofSale(sale: Sale): string;
  name(key: string): string;
  /** Todas as páginas conhecidas (já com junções aplicadas). */
  keys(): string[];
}

export function buildResolver(ads: AdInfo[], pages: PageInfo[], productPages: ProductPage[]): PageResolver {
  const info = new Map(pages.map((p) => [p.key, p]));
  const resolve = (key: string | null): string => {
    let k = key ?? NO_PAGE;
    for (let i = 0; i < 5; i++) {
      const next = info.get(k)?.merge_into;
      if (!next || next === k) break;
      k = next;
    }
    return k;
  };
  const adPage = new Map<string, string>();
  for (const a of ads) {
    const key = normalizePageUrl(a.link_url);
    if (key) adPage.set(a.ad_id, resolve(key));
  }
  const prodPage = new Map(productPages.map((p) => [p.product, resolve(p.page_key)]));

  const all = new Set<string>();
  for (const k of adPage.values()) all.add(k);
  for (const k of prodPage.values()) all.add(k);
  for (const p of pages) all.add(resolve(p.key));

  return {
    ofAd: (adId) => (adId && adPage.get(adId)) || NO_PAGE,
    ofSale: (s) => {
      if (s.ad_id && adPage.has(s.ad_id)) return adPage.get(s.ad_id)!;
      const prod = s.checkout_title ?? s.product_titles;
      if (prod && prodPage.has(prod)) return prodPage.get(prod)!;
      return NO_PAGE;
    },
    name: (key) => (key === NO_PAGE ? "Sem página identificada" : info.get(key)?.name || key),
    keys: () => [...all].filter((k) => k !== NO_PAGE),
  };
}

export interface PageRow extends Totals, Derived {
  id: string;
  name: string;
  url: string;
  campaigns: number;
  active_ads: number;
  situation: Situation;
}

/** Agrupa gasto do Meta e vendas da Wiapy por página de venda. */
export function groupByPage(
  insights: AdInsight[],
  sales: Sale[],
  ads: AdInfo[],
  resolver: PageResolver,
  settings: Settings,
): PageRow[] {
  const groups = new Map<string, { t: Totals; camps: Set<string> }>();
  const get = (k: string) => {
    let g = groups.get(k);
    if (!g) groups.set(k, (g = { t: emptyTotals(), camps: new Set() }));
    return g;
  };
  for (const i of insights) {
    const g = get(resolver.ofAd(i.ad_id));
    addInsight(g.t, i, settings);
    if (i.campaign_id && Number(i.spend) > 0) g.camps.add(i.campaign_id);
  }
  for (const s of sales) addSale(get(resolver.ofSale(s)).t, s, settings);

  const active = new Map<string, number>();
  for (const a of ads) {
    if (String(a.status).toUpperCase() !== "ACTIVE") continue;
    const k = resolver.ofAd(a.ad_id);
    active.set(k, (active.get(k) ?? 0) + 1);
  }

  const rows: PageRow[] = [];
  for (const [key, g] of groups) {
    finish(g.t);
    if (g.t.spend === 0 && g.t.sales === 0) continue;
    const d = derive(g.t);
    rows.push({
      id: key,
      name: resolver.name(key),
      url: prettyUrl(key),
      campaigns: g.camps.size,
      active_ads: active.get(key) ?? 0,
      ...g.t,
      ...d,
      situation: key === NO_PAGE ? "aprendendo" : situation(g.t, d, settings),
    });
  }
  return rows.sort((a, b) => (a.id === NO_PAGE ? 1 : b.id === NO_PAGE ? -1 : b.profit - a.profit));
}
