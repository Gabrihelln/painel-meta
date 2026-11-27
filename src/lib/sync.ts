import { fetchAds, fetchInsights, metaConfigFromEnv } from "./meta";
import { saveSettings, upsertAds, upsertInsights } from "./db";
import { addDays, localDate } from "./period";

export interface SyncResult {
  ok: boolean;
  since?: string;
  until?: string;
  insights?: number;
  ads?: number;
  error?: string;
}

/** Busca no Meta os últimos `days` dias (por anúncio, por dia) e grava no banco. */
export async function syncMeta(days = 3): Promise<SyncResult> {
  const cfg = metaConfigFromEnv();
  if (!cfg) return { ok: false, error: "META_ACCESS_TOKEN ou META_AD_ACCOUNT_IDS não configurados" };
  const until = localDate(new Date());
  const since = addDays(until, -(Math.min(Math.max(days, 1), 90) - 1));
  try {
    const [insights, ads] = await Promise.all([fetchInsights(cfg, since, until), fetchAds(cfg)]);
    await upsertInsights(insights);
    await upsertAds(ads);
    await saveSettings({ last_meta_sync_at: new Date().toISOString(), last_meta_sync_error: null });
    return { ok: true, since, until, insights: insights.length, ads: ads.length };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await saveSettings({ last_meta_sync_error: error }).catch(() => {});
    return { ok: false, since, until, error };
  }
}
