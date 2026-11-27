import type { AdInfo, AdInsight, Sale, Settings } from "./types";
import { localDate } from "./period";
import { adStatusKey, type AdStatusKey } from "./adStatus";

export type Level = "campanha" | "conjunto" | "anuncio";

export interface Totals {
  spend: number; // reais
  impressions: number;
  reach: number;
  link_clicks: number;
  landing_page_views: number;
  initiate_checkouts: number;
  video_3s_views: number;
  thruplays: number;
  sales: number; // vendas pagas
  revenue: number; // reais (pagas)
  fees: number; // reais (taxa Wiapy)
  taxes: number; // reais
  fixed_costs: number; // reais
  ad_taxes: number; // reais (imposto/IOF sobre o gasto em anúncios)
  profit: number; // reais
}

export interface Derived {
  roas: number | null;
  roi: number | null; // %
  cpa: number | null;
  ctr: number | null; // %
  cpm: number | null;
  cpc: number | null;
  hook: number | null; // % retenção 3s
  thruplay_rate: number | null; // %
  page_conversion: number | null; // %
}

export type Situation = "escalar" | "bom" | "atencao" | "pausar" | "aprendendo";

export interface Row extends Totals, Derived {
  id: string;
  name: string;
  parent: string | null; // nome da campanha (para conjunto/anúncio)
  campaign_id: string | null;
  adset_id: string | null;
  creative_type: string | null;
  thumbnail_url: string | null;
  /** Status de entrega no Meta (só no nível anúncio). */
  ad_status: AdStatusKey | null;
  ad_status_raw: string | null;
  situation: Situation;
}

export function emptyTotals(): Totals {
  return {
    spend: 0, impressions: 0, reach: 0, link_clicks: 0, landing_page_views: 0,
    initiate_checkouts: 0, video_3s_views: 0, thruplays: 0,
    sales: 0, revenue: 0, fees: 0, taxes: 0, fixed_costs: 0, ad_taxes: 0, profit: 0,
  };
}

export function addInsight(t: Totals, i: AdInsight, settings: Settings) {
  const spend = Number(i.spend) || 0;
  t.spend += spend;
  t.ad_taxes += (spend * (settings.ad_tax_percent || 0)) / 100;
  t.impressions += i.impressions || 0;
  t.reach += i.reach || 0;
  t.link_clicks += i.link_clicks || 0;
  t.landing_page_views += i.landing_page_views || 0;
  t.initiate_checkouts += i.initiate_checkouts || 0;
  t.video_3s_views += i.video_3s_views || 0;
  t.thruplays += i.thruplays || 0;
}

export function addSale(t: Totals, s: Sale, settings: Settings) {
  if (s.status !== "paid") return;
  const revenue = s.amount_cents / 100;
  t.sales += 1;
  t.revenue += revenue;
  t.fees += s.fee_cents / 100;
  t.taxes += (revenue * settings.tax_percent) / 100;
  t.fixed_costs += settings.fixed_cost_per_sale_cents / 100;
}

export function finish(t: Totals): Totals {
  t.profit = t.revenue - t.fees - t.taxes - t.fixed_costs - t.spend - t.ad_taxes;
  return t;
}

const div = (a: number, b: number) => (b > 0 ? a / b : null);

export function derive(t: Totals): Derived {
  return {
    roas: div(t.revenue, t.spend),
    roi: t.spend > 0 ? (t.profit / (t.spend + t.ad_taxes)) * 100 : null,
    cpa: t.sales > 0 && t.spend > 0 ? t.spend / t.sales : null,
    ctr: t.impressions > 0 ? (t.link_clicks / t.impressions) * 100 : null,
    cpm: t.impressions > 0 ? (t.spend / t.impressions) * 1000 : null,
    cpc: div(t.spend, t.link_clicks),
    hook: t.impressions > 0 && t.video_3s_views > 0 ? (t.video_3s_views / t.impressions) * 100 : null,
    thruplay_rate: t.impressions > 0 && t.thruplays > 0 ? (t.thruplays / t.impressions) * 100 : null,
    page_conversion: t.landing_page_views > 0 ? (t.sales / t.landing_page_views) * 100 : null,
  };
}

export function situation(t: Totals, d: Derived, s: Settings): Situation {
  if (t.spend < s.min_spend_to_judge && t.profit < 0) return "aprendendo";
  if (t.spend <= 0) return t.sales > 0 ? "bom" : "aprendendo";
  const roi = d.roi ?? 0;
  if (roi < s.roi_pause) return "pausar";
  if (roi < s.roi_attention) return "atencao";
  if (roi >= s.roi_scale) return "escalar";
  return "bom";
}

export const SITUATION_LABEL: Record<Situation, string> = {
  escalar: "Escalar",
  bom: "Bom",
  atencao: "Atenção",
  pausar: "Pausar",
  aprendendo: "Aprendendo",
};

export function summarize(insights: AdInsight[], sales: Sale[], settings: Settings): Totals & Derived {
  const t = emptyTotals();
  insights.forEach((i) => addInsight(t, i, settings));
  sales.forEach((s) => addSale(t, s, settings));
  finish(t);
  return { ...t, ...derive(t) };
}

/** Agrupa métricas do Meta + vendas da Wiapy por campanha, conjunto ou anúncio. */
export function groupBy(
  level: Level,
  insights: AdInsight[],
  sales: Sale[],
  ads: AdInfo[],
  settings: Settings,
): Row[] {
  const adMeta = new Map<string, { campaign_id: string | null; campaign_name: string | null; adset_id: string | null; adset_name: string | null; ad_name: string | null }>();
  for (const i of insights) {
    adMeta.set(i.ad_id, {
      campaign_id: i.campaign_id, campaign_name: i.campaign_name,
      adset_id: i.adset_id, adset_name: i.adset_name, ad_name: i.ad_name,
    });
  }
  const adInfo = new Map(ads.map((a) => [a.ad_id, a]));
  for (const a of ads) {
    if (!adMeta.has(a.ad_id)) {
      adMeta.set(a.ad_id, { campaign_id: a.campaign_id, campaign_name: null, adset_id: a.adset_id, adset_name: null, ad_name: a.ad_name });
    }
  }
  const campaignNames = new Map<string, string>();
  const adsetNames = new Map<string, string>();
  for (const m of adMeta.values()) {
    if (m.campaign_id && m.campaign_name) campaignNames.set(m.campaign_id, m.campaign_name);
    if (m.adset_id && m.adset_name) adsetNames.set(m.adset_id, m.adset_name);
  }

  const keyOf = (adId: string): string | null => {
    const m = adMeta.get(adId);
    if (!m) return null;
    if (level === "anuncio") return adId;
    if (level === "conjunto") return m.adset_id;
    return m.campaign_id;
  };

  const groups = new Map<string, { t: Totals; adId: string }>();
  const get = (key: string, adId: string) => {
    let g = groups.get(key);
    if (!g) {
      g = { t: emptyTotals(), adId };
      groups.set(key, g);
    }
    return g;
  };

  for (const i of insights) {
    const k = keyOf(i.ad_id);
    if (k) addInsight(get(k, i.ad_id).t, i, settings);
  }
  for (const s of sales) {
    if (!s.ad_id) continue;
    const k = keyOf(s.ad_id);
    if (k) addSale(get(k, s.ad_id).t, s, settings);
  }

  const rows: Row[] = [];
  for (const [key, g] of groups) {
    finish(g.t);
    const d = derive(g.t);
    const m = adMeta.get(g.adId)!;
    const info = adInfo.get(g.adId);
    const name =
      level === "anuncio" ? (m.ad_name ?? info?.ad_name ?? key)
      : level === "conjunto" ? (adsetNames.get(key) ?? key)
      : (campaignNames.get(key) ?? key);
    rows.push({
      id: key,
      name,
      parent: level === "campanha" ? null : (m.campaign_id ? campaignNames.get(m.campaign_id) ?? null : null),
      campaign_id: m.campaign_id,
      adset_id: m.adset_id,
      creative_type: level === "anuncio" ? info?.creative_type ?? null : null,
      thumbnail_url: level === "anuncio" ? info?.thumbnail_url ?? null : null,
      ad_status: level === "anuncio" ? adStatusKey(info?.status) : null,
      ad_status_raw: level === "anuncio" ? info?.status ?? null : null,
      ...g.t,
      ...d,
      situation: situation(g.t, d, settings),
    });
  }
  return rows.sort((a, b) => b.profit - a.profit);
}

/** Lucro por dia (para o gráfico do resumo). */
export function profitByDay(days: string[], insights: AdInsight[], sales: Sale[], settings: Settings) {
  const map = new Map(days.map((d) => [d, emptyTotals()]));
  for (const i of insights) {
    const t = map.get(i.date);
    if (t) addInsight(t, i, settings);
  }
  for (const s of sales) {
    const t = map.get(localDate(s.created_at));
    if (t) addSale(t, s, settings);
  }
  return days.map((d) => {
    const t = finish(map.get(d)!);
    return { date: d, profit: t.profit, revenue: t.revenue, spend: t.spend, sales: t.sales };
  });
}
