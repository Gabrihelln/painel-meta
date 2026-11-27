import { describe, expect, it } from "vitest";
import { extractAdId, parseWiapyPayload } from "./wiapy";
import { cleanToken, parseInsightRow, tokenHint } from "./meta";
import { groupBy, summarize } from "./metrics";
import { localDate, parsePeriod, startOfLocalDayUtc } from "./period";
import { DEFAULT_SETTINGS, type AdInsight, type Sale } from "./types";

// Exemplo da documentação da Wiapy (corrigido para JSON válido).
const sample = {
  payment: {
    id: "680bb49dcc58d1620569cb2e", status: "paid", amount: 1770, payment_method: "pix", type: "payment",
    installments: 0, pix_boleto: { code: "x", url: "y" }, fee: 190,
    dt_create: "2025-04-25T16:13:17.284Z", dt_update: "2025-04-25T16:13:17.284Z",
  },
  subscription: {},
  customer: { id: "c1", name: "Thay", email: "thay@wiapy.com", mobile_phone: "(11) 99999-9999", document: "1" },
  checkout: { id: "chk", title: "Produto teste", amount: 990, orderbump: [{ id: "ob", title: "Orderbump teste", amount: 780 }] },
  products: [{ id: "p1", title: "Nome do meu produto 1", type: "Curso Online", itens: [] }],
  tracking: { ip: null, useragent: null, fbc: null, fbp: null, utm_source: "meta", utm_medium: "paid", utm_campaign: "Camp", utm_content: "120212345678900123", utm_term: null },
};

describe("wiapy", () => {
  it("lê uma venda", () => {
    const r = parseWiapyPayload(sample);
    expect(r.kind).toBe("sale");
    if (r.kind !== "sale") return;
    expect(r.sale.id).toBe("680bb49dcc58d1620569cb2e");
    expect(r.sale.amount_cents).toBe(1770);
    expect(r.sale.fee_cents).toBe(190);
    expect(r.sale.orderbump_cents).toBe(780);
    expect(r.sale.ad_id).toBe("120212345678900123");
    expect(r.sale.customer_name).toBe("Thay");
  });

  it("ignora carrinho abandonado", () => {
    const r = parseWiapyPayload({ payment: null, customer: { name: "Thay" }, checkout: { id: "x" } });
    expect(r.kind).toBe("ignored");
  });

  it("extrai id do anúncio de vários formatos", () => {
    expect(extractAdId("120212345678900123")).toBe("120212345678900123");
    expect(extractAdId("Vídeo 03|120212345678900123")).toBe("120212345678900123");
    expect(extractAdId("criativo-azul")).toBeNull();
    expect(extractAdId(null)).toBeNull();
  });
});

describe("meta", () => {
  it("limpa o token colado com aspas, espaços ou prefixo", () => {
    expect(cleanToken('  "EAAabc123"  ')).toBe("EAAabc123");
    expect(cleanToken("META_ACCESS_TOKEN=EAAabc\n123")).toBe("EAAabc123");
    expect(cleanToken("Bearer EAAabc123")).toBe("EAAabc123");
    expect(tokenHint("EAAabc123")).toContain('"EAA", 9 caracteres');
  });

  it("converte uma linha de insights", () => {
    const row = parseInsightRow({
      date_start: "2026-11-27", ad_id: "9", campaign_id: "1", adset_id: "2", ad_name: "A",
      spend: "12.345", impressions: "1000", reach: "800", inline_link_clicks: "25",
      actions: [{ action_type: "landing_page_view", value: "20" }, { action_type: "video_view", value: "300" }, { action_type: "initiate_checkout", value: "4" }],
      video_thruplay_watched_actions: [{ action_type: "video_view", value: "120" }],
    });
    expect(row.spend).toBe(12.35);
    expect(row.landing_page_views).toBe(20);
    expect(row.video_3s_views).toBe(300);
    expect(row.thruplays).toBe(120);
    expect(row.initiate_checkouts).toBe(4);
  });
});

describe("métricas", () => {
  const ins: AdInsight[] = [
    { date: "2026-11-27", ad_id: "a1", account_id: null, campaign_id: "c1", campaign_name: "C1", adset_id: "s1", adset_name: "S1", ad_name: "Ad 1", spend: 100, impressions: 10000, reach: 0, link_clicks: 200, landing_page_views: 150, initiate_checkouts: 20, video_3s_views: 3000, thruplays: 0 },
    { date: "2026-11-27", ad_id: "a2", account_id: null, campaign_id: "c1", campaign_name: "C1", adset_id: "s1", adset_name: "S1", ad_name: "Ad 2", spend: 200, impressions: 10000, reach: 0, link_clicks: 50, landing_page_views: 30, initiate_checkouts: 2, video_3s_views: 0, thruplays: 0 },
  ];
  const sale = (id: string, ad: string | null, status = "paid"): Sale => ({
    id, status, payment_method: "pix", payment_type: "payment", amount_cents: 10000, fee_cents: 500, orderbump_cents: 0,
    created_at: "2026-11-27T15:00:00Z", updated_at: "2026-11-27T15:00:00Z", customer_name: null, customer_email: null,
    checkout_id: null, checkout_title: null, product_titles: null, utm_source: null, utm_medium: null, utm_campaign: null,
    utm_content: ad, utm_term: null, ad_id: ad, fbc: null, fbp: null,
  });
  const sales = [sale("1", "a1"), sale("2", "a1"), sale("3", "a1"), sale("4", null), sale("5", "a2", "unpaid")];
  const settings = { ...DEFAULT_SETTINGS, tax_percent: 10 };

  it("resume o período", () => {
    const t = summarize(ins, sales, settings);
    expect(t.sales).toBe(4);
    expect(t.revenue).toBe(400);
    // 400 - 20 taxa - 40 imposto - 300 gasto
    expect(t.profit).toBeCloseTo(40);
    expect(t.roas).toBeCloseTo(400 / 300);
  });

  it("agrupa por anúncio com situação", () => {
    const rows = groupBy("anuncio", ins, sales, [], settings);
    const a1 = rows.find((r) => r.id === "a1")!;
    const a2 = rows.find((r) => r.id === "a2")!;
    expect(a1.sales).toBe(3);
    expect(a1.profit).toBeCloseTo(300 - 15 - 30 - 100);
    expect(a1.situation).toBe("escalar"); // ROI 155%
    expect(a1.hook).toBeCloseTo(30);
    expect(a2.situation).toBe("pausar");
    const camp = groupBy("campanha", ins, sales, [], settings);
    expect(camp).toHaveLength(1);
    expect(camp[0].spend).toBe(300);
  });
});

describe("datas", () => {
  it("usa o fuso de São Paulo", () => {
    expect(localDate("2026-11-28T02:30:00Z")).toBe("2026-11-27");
    expect(startOfLocalDayUtc("2026-11-27")).toBe("2026-11-27T03:00:00.000Z");
    const r = parsePeriod("7d", new Date("2026-11-27T12:00:00Z"));
    expect(r.since).toBe("2026-11-21");
    expect(r.until).toBe("2026-11-27");
  });
});
