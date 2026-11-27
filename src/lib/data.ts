import * as store from "./db";
import { demoAds, demoInsights, demoSales } from "./demo";
import type { AdInfo, AdInsight, Sale, Settings } from "./types";
import type { PageInfo, ProductPage } from "./pages";
import { DEFAULT_SETTINGS } from "./types";

// Escolhe entre banco real e dados de exemplo.
export const isDemo = store.isDemo;

let demoSettings: Settings = { ...DEFAULT_SETTINGS, tax_percent: 6 };

export async function loadSales(since: string, until: string): Promise<Sale[]> {
  return isDemo() ? demoSales(since, until) : store.getSales(since, until);
}

export async function loadInsights(since: string, until: string): Promise<AdInsight[]> {
  return isDemo() ? demoInsights(since, until) : store.getInsights(since, until);
}

export async function loadAds(): Promise<AdInfo[]> {
  return isDemo() ? demoAds() : store.getAds();
}

export async function loadSettings(): Promise<Settings> {
  return isDemo() ? demoSettings : store.getSettings();
}

export async function storeSettings(s: Partial<Settings>) {
  if (isDemo()) {
    demoSettings = { ...demoSettings, ...s };
    return;
  }
  await store.saveSettings(s);
}

let demoPages: PageInfo[] = [
  { key: "meusite.com/oferta-principal", name: "Oferta principal", merge_into: null },
  { key: "meusite.com/oferta-2", name: "Oferta 2", merge_into: null },
];
let demoProductPages: ProductPage[] = [];

export async function loadPagesData(): Promise<store.PagesData> {
  if (isDemo()) return { pages: demoPages, productPages: demoProductPages, needsMigration: false };
  return store.getPagesData();
}

export async function storePagesData(pages: PageInfo[], productPages: ProductPage[], cleared: string[]) {
  if (isDemo()) {
    const byKey = new Map(demoPages.map((p) => [p.key, p]));
    for (const p of pages) byKey.set(p.key, p);
    demoPages = [...byKey.values()];
    const byProd = new Map(demoProductPages.map((p) => [p.product, p]));
    for (const p of productPages) byProd.set(p.product, p);
    for (const c of cleared) byProd.delete(c);
    demoProductPages = [...byProd.values()];
    return;
  }
  await store.savePagesData(pages, productPages, cleared);
}

export async function loadProductNames(): Promise<string[]> {
  if (isDemo()) return ["Método Exemplo"];
  return store.getProductNames();
}

export async function loadAll(since: string, until: string) {
  const [sales, insights, ads, settings] = await Promise.all([
    loadSales(since, until),
    loadInsights(since, until),
    loadAds(),
    loadSettings(),
  ]);
  return { sales, insights, ads, settings };
}
