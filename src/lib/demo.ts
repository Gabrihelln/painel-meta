// Dados de exemplo para o modo demonstração (sem Supabase configurado).
import type { AdInfo, AdInsight, Sale } from "./types";
import { addDays, localDate, startOfLocalDayUtc } from "./period";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const CAMPAIGNS = [
  { id: "2385001", name: "[CBO] Depoimentos" },
  { id: "2385002", name: "[ABO] Teste criativos" },
  { id: "2385003", name: "[CBO] Remarketing" },
  { id: "2385004", name: "[ABO] Público frio 02" },
];

const ADS = [
  { id: "1202001", name: "Vídeo depoimento 03", c: 0, s: "Aberto 25-45", type: "video", spend: 180, conv: 0.05, ctr: 2.8, hook: 0.38 },
  { id: "1202002", name: "Vídeo depoimento 01", c: 0, s: "Aberto 25-45", type: "video", spend: 90, conv: 0.035, ctr: 2.2, hook: 0.33 },
  { id: "1202003", name: "Carrossel benefícios", c: 1, s: "Interesses A", type: "image", spend: 140, conv: 0.038, ctr: 1.9, hook: 0 },
  { id: "1202004", name: "Vídeo bastidores 01", c: 1, s: "Interesses B", type: "video", spend: 110, conv: 0.03, ctr: 2.1, hook: 0.31 },
  { id: "1202005", name: "Vídeo problema x solução", c: 1, s: "Interesses A", type: "video", spend: 85, conv: 0.014, ctr: 1.1, hook: 0.19 },
  { id: "1202006", name: "Imagem prova social", c: 2, s: "Visitantes 30d", type: "image", spend: 60, conv: 0.06, ctr: 2.4, hook: 0 },
  { id: "1202007", name: "Imagem oferta 01", c: 3, s: "Lookalike 1%", type: "image", spend: 120, conv: 0.004, ctr: 0.7, hook: 0 },
  { id: "1202008", name: "Vídeo UGC 02", c: 3, s: "Lookalike 1%", type: "video", spend: 70, conv: 0.012, ctr: 1.3, hook: 0.24 },
];

const NAMES = ["Mariana S.", "João P.", "Ana L.", "Carlos M.", "Rafael T.", "Beatriz C.", "Lucas F.", "Juliana R.", "Pedro H.", "Camila A.", "Bruno D.", "Larissa V."];
const PRICE = 9700;
const BUMP = 4700;

let cache: { key: string; insights: AdInsight[]; sales: Sale[]; ads: AdInfo[] } | null = null;

function build() {
  const today = localDate(new Date());
  if (cache?.key === today) return cache;
  const r = rng(42);
  const insights: AdInsight[] = [];
  const sales: Sale[] = [];
  let saleN = 0;
  const now = Date.now();
  for (let back = 40; back >= 0; back--) {
    const date = addDays(today, -back);
    const isToday = back === 0;
    const hoursFrac = isToday ? Math.max(0.15, ((now - Date.parse(startOfLocalDayUtc(today))) / 86400_000)) : 1;
    const dayFactor = 0.7 + r() * 0.6;
    for (const ad of ADS) {
      const camp = CAMPAIGNS[ad.c];
      const spend = Math.round(ad.spend * dayFactor * hoursFrac * (0.8 + r() * 0.4) * 100) / 100;
      const cpm = 22 + r() * 12;
      const impressions = Math.round((spend / cpm) * 1000);
      const link_clicks = Math.round((impressions * ad.ctr * (0.85 + r() * 0.3)) / 100);
      const lpv = Math.round(link_clicks * (0.72 + r() * 0.12));
      const ic = Math.round(lpv * (0.15 + r() * 0.06));
      insights.push({
        date, ad_id: ad.id, account_id: "100200300", campaign_id: camp.id, campaign_name: camp.name,
        adset_id: `${camp.id}-${ad.s}`, adset_name: ad.s, ad_name: ad.name, spend, impressions,
        reach: Math.round(impressions * 0.82), link_clicks, landing_page_views: lpv, initiate_checkouts: ic,
        video_3s_views: ad.hook ? Math.round(impressions * ad.hook * (0.9 + r() * 0.2)) : 0,
        thruplays: ad.hook ? Math.round(impressions * ad.hook * 0.45 * (0.9 + r() * 0.2)) : 0,
      });
      const n = Math.round(lpv * ad.conv * (0.6 + r() * 0.8));
      for (let k = 0; k < n + 2; k++) {
        const isPaidCandidate = k < n;
        const created = new Date(Date.parse(startOfLocalDayUtc(date)) + r() * 86400_000 * hoursFrac);
        if (created.getTime() > now) continue;
        const method = r() < 0.72 ? "pix" : "credit_card";
        let status = "paid";
        if (!isPaidCandidate) status = method === "pix" ? "unpaid" : "credit_card_declined";
        else if (r() < 0.03) status = "refunded";
        const bump = r() < 0.3 ? BUMP : 0;
        const amount = PRICE + bump;
        saleN++;
        sales.push({
          id: `demo-${saleN}`, status, payment_method: method, payment_type: "payment",
          amount_cents: amount, fee_cents: Math.round(amount * (method === "pix" ? 0.0499 : 0.0699)) + 100,
          orderbump_cents: bump, created_at: created.toISOString(), updated_at: created.toISOString(),
          customer_name: NAMES[Math.floor(r() * NAMES.length)], customer_email: null,
          checkout_id: "chk1", checkout_title: "Método Exemplo", product_titles: bump ? "Método Exemplo, Bônus" : "Método Exemplo",
          utm_source: "meta", utm_medium: "paid", utm_campaign: camp.name, utm_content: ad.id, utm_term: null,
          ad_id: ad.id, fbc: null, fbp: null,
        });
      }
    }
    // vendas sem rastreio (orgânico/link direto)
    const organic = Math.floor(r() * 3 * hoursFrac);
    for (let k = 0; k < organic; k++) {
      const created = new Date(Date.parse(startOfLocalDayUtc(date)) + r() * 86400_000 * hoursFrac);
      if (created.getTime() > now) continue;
      saleN++;
      sales.push({
        id: `demo-${saleN}`, status: "paid", payment_method: "pix", payment_type: "payment",
        amount_cents: PRICE, fee_cents: Math.round(PRICE * 0.0499) + 100, orderbump_cents: 0,
        created_at: created.toISOString(), updated_at: created.toISOString(),
        customer_name: NAMES[Math.floor(r() * NAMES.length)], customer_email: null, checkout_id: "chk1",
        checkout_title: "Método Exemplo", product_titles: "Método Exemplo",
        utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null,
        ad_id: null, fbc: null, fbp: null,
      });
    }
  }
  sales.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ads: AdInfo[] = ADS.map((a) => ({
    ad_id: a.id, ad_name: a.name, adset_id: `${CAMPAIGNS[a.c].id}-${a.s}`, campaign_id: CAMPAIGNS[a.c].id,
    status: a.id === "1202007" ? "PAUSED" : a.id === "1202008" ? "CAMPAIGN_PAUSED" : "ACTIVE",
    creative_type: a.type, thumbnail_url: null,
  }));
  cache = { key: today, insights, sales, ads };
  return cache;
}

export function demoSales(since: string, until: string): Sale[] {
  return build().sales.filter((s) => {
    const d = localDate(s.created_at);
    return d >= since && d <= until;
  });
}

export function demoInsights(since: string, until: string): AdInsight[] {
  return build().insights.filter((i) => i.date >= since && i.date <= until);
}

export function demoAds(): AdInfo[] {
  return build().ads;
}
