import * as store from "./db";
import { demoAds, demoInsights, demoSales } from "./demo";
import type { AdInfo, AdInsight, Sale, Settings } from "./types";
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

export async function loadAll(since: string, until: string) {
  const [sales, insights, ads, settings] = await Promise.all([
    loadSales(since, until),
    loadInsights(since, until),
    loadAds(),
    loadSettings(),
  ]);
  return { sales, insights, ads, settings };
}
