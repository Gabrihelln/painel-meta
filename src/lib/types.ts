export type SaleStatus =
  | "paid"
  | "unpaid"
  | "credit_card_declined"
  | "refunded"
  | "chargedback";

export interface Sale {
  id: string;
  status: SaleStatus | string;
  payment_method: string | null;
  payment_type: string | null;
  amount_cents: number;
  fee_cents: number;
  orderbump_cents: number;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  customer_email: string | null;
  checkout_id: string | null;
  checkout_title: string | null;
  product_titles: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  ad_id: string | null;
  fbc: string | null;
  fbp: string | null;
  received_at?: string;
}

export interface AdInsight {
  date: string; // YYYY-MM-DD
  ad_id: string;
  account_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  ad_name: string | null;
  spend: number; // reais
  impressions: number;
  reach: number;
  link_clicks: number;
  landing_page_views: number;
  initiate_checkouts: number;
  video_3s_views: number;
  thruplays: number;
}

export interface AdInfo {
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  campaign_id: string | null;
  status: string | null;
  creative_type: string | null;
  thumbnail_url: string | null;
}

export interface Settings {
  tax_percent: number;
  /** Imposto/IOF cobrado sobre o gasto em anúncios (% somado ao gasto do Meta). */
  ad_tax_percent: number;
  fixed_cost_per_sale_cents: number;
  min_spend_to_judge: number;
  roi_pause: number;
  roi_attention: number;
  roi_scale: number;
  last_meta_sync_at: string | null;
  last_meta_sync_error: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  tax_percent: 0,
  ad_tax_percent: 0,
  fixed_cost_per_sale_cents: 0,
  min_spend_to_judge: 100,
  roi_pause: 0,
  roi_attention: 50,
  roi_scale: 150,
  last_meta_sync_at: null,
  last_meta_sync_error: null,
};
