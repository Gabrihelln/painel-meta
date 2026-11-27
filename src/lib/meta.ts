import type { AdInfo, AdInsight } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const INSIGHT_FIELDS = [
  "account_id", "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
  "spend", "impressions", "reach", "inline_link_clicks", "actions", "video_thruplay_watched_actions",
].join(",");

function actionValue(list: any[] | undefined, types: string[]): number {
  if (!Array.isArray(list)) return 0;
  for (const type of types) {
    const hit = list.find((a) => a?.action_type === type);
    if (hit) return Math.round(Number(hit.value) || 0);
  }
  return 0;
}

/** Converte uma linha da API de Insights do Meta para a tabela `ad_insights`. */
export function parseInsightRow(r: any): AdInsight {
  return {
    date: String(r.date_start),
    ad_id: String(r.ad_id),
    account_id: r.account_id ? String(r.account_id) : null,
    campaign_id: r.campaign_id ? String(r.campaign_id) : null,
    campaign_name: r.campaign_name ?? null,
    adset_id: r.adset_id ? String(r.adset_id) : null,
    adset_name: r.adset_name ?? null,
    ad_name: r.ad_name ?? null,
    spend: Math.round((Number(r.spend) || 0) * 100) / 100,
    impressions: Number(r.impressions) || 0,
    reach: Number(r.reach) || 0,
    link_clicks: Number(r.inline_link_clicks) || 0,
    landing_page_views: actionValue(r.actions, ["landing_page_view", "omni_landing_page_view"]),
    initiate_checkouts: actionValue(r.actions, [
      "initiate_checkout", "omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout",
    ]),
    video_3s_views: actionValue(r.actions, ["video_view"]),
    thruplays: actionValue(r.video_thruplay_watched_actions, ["video_view"]),
  };
}

export function parseAdRow(r: any): AdInfo {
  const c = r.creative ?? {};
  const objectType = String(c.object_type ?? "").toUpperCase();
  const type: string | null =
    c.video_id || objectType === "VIDEO" ? "video" : objectType ? "image" : null;
  return {
    ad_id: String(r.id),
    ad_name: r.name ?? null,
    adset_id: r.adset_id ? String(r.adset_id) : null,
    campaign_id: r.campaign_id ? String(r.campaign_id) : null,
    status: r.effective_status ?? null,
    creative_type: type,
    thumbnail_url: c.thumbnail_url ?? c.image_url ?? null,
  };
}

export interface MetaConfig {
  token: string;
  accounts: string[];
  version: string;
}

export function metaConfigFromEnv(): MetaConfig | null {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const accounts = (process.env.META_AD_ACCOUNT_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("act_") ? s : `act_${s}`));
  if (!token || accounts.length === 0) return null;
  return { token, accounts, version: process.env.META_API_VERSION?.trim() || "v24.0" };
}

async function getAllPages(url: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null = url;
  let guard = 0;
  while (next && guard++ < 50) {
    const res: Response = await fetch(next, { cache: "no-store" });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Meta API: ${msg}`);
    }
    out.push(...(json.data ?? []));
    next = json.paging?.next ?? null;
  }
  return out;
}

export async function fetchInsights(cfg: MetaConfig, since: string, until: string): Promise<AdInsight[]> {
  const rows: AdInsight[] = [];
  for (const acc of cfg.accounts) {
    const params = new URLSearchParams({
      level: "ad",
      fields: INSIGHT_FIELDS,
      time_range: JSON.stringify({ since, until }),
      time_increment: "1",
      limit: "500",
      access_token: cfg.token,
    });
    const data = await getAllPages(`https://graph.facebook.com/${cfg.version}/${acc}/insights?${params}`);
    rows.push(...data.map(parseInsightRow));
  }
  return rows;
}

export async function fetchAds(cfg: MetaConfig): Promise<AdInfo[]> {
  const out: AdInfo[] = [];
  for (const acc of cfg.accounts) {
    const params = new URLSearchParams({
      fields: "id,name,effective_status,adset_id,campaign_id,creative{thumbnail_url,image_url,object_type,video_id}",
      limit: "200",
      access_token: cfg.token,
    });
    const data = await getAllPages(`https://graph.facebook.com/${cfg.version}/${acc}/ads?${params}`);
    out.push(...data.map(parseAdRow));
  }
  return out;
}
