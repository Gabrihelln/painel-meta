-- Painel de vendas: rode este arquivo inteiro no SQL Editor do Supabase (uma vez).

-- Vendas recebidas pelo webhook da Wiapy (uma linha por pagamento).
create table if not exists sales (
  id                text primary key,          -- payment.id da Wiapy
  status            text not null,             -- paid | unpaid | credit_card_declined | refunded | chargedback
  payment_method    text,                      -- pix | credit_card | boleto
  payment_type      text,                      -- payment | subscription
  amount_cents      integer not null default 0,
  fee_cents         integer not null default 0,
  orderbump_cents   integer not null default 0,
  created_at        timestamptz not null,
  updated_at        timestamptz not null,
  customer_name     text,
  customer_email    text,
  checkout_id       text,
  checkout_title    text,
  product_titles    text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  utm_content       text,
  utm_term          text,
  ad_id             text,                      -- id do anúncio do Meta extraído da UTM
  fbc               text,
  fbp               text,
  raw               jsonb,
  received_at       timestamptz not null default now()
);
create index if not exists sales_created_at_idx on sales (created_at);
create index if not exists sales_ad_id_idx on sales (ad_id);

-- Métricas diárias de cada anúncio, vindas da API do Meta.
create table if not exists ad_insights (
  date               date not null,
  ad_id              text not null,
  account_id         text,
  campaign_id        text,
  campaign_name      text,
  adset_id           text,
  adset_name         text,
  ad_name            text,
  spend              numeric(12,2) not null default 0,
  impressions        integer not null default 0,
  reach              integer not null default 0,
  link_clicks        integer not null default 0,
  landing_page_views integer not null default 0,
  initiate_checkouts integer not null default 0,
  video_3s_views     integer not null default 0,
  thruplays          integer not null default 0,
  updated_at         timestamptz not null default now(),
  primary key (date, ad_id)
);

-- Dados do criativo (nome, tipo, miniatura).
create table if not exists ads (
  ad_id          text primary key,
  ad_name        text,
  adset_id       text,
  campaign_id    text,
  status         text,
  creative_type  text,                         -- video | image | carousel
  thumbnail_url  text,
  updated_at     timestamptz not null default now()
);

-- Configurações do painel (linha única, id = 1).
create table if not exists settings (
  id                         integer primary key default 1 check (id = 1),
  tax_percent                numeric(5,2) not null default 0,
  fixed_cost_per_sale_cents  integer not null default 0,
  min_spend_to_judge         numeric(10,2) not null default 100,
  roi_pause                  numeric(8,2) not null default 0,
  roi_attention              numeric(8,2) not null default 50,
  roi_scale                  numeric(8,2) not null default 150,
  last_meta_sync_at          timestamptz,
  last_meta_sync_error       text
);
insert into settings (id) values (1) on conflict (id) do nothing;

-- Segurança: o painel acessa o banco só pelo servidor (service role).
-- Bloqueia qualquer acesso público pela chave anon.
alter table sales enable row level security;
alter table ad_insights enable row level security;
alter table ads enable row level security;
alter table settings enable row level security;
