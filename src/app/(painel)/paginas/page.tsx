import Link from "next/link";
import MetricsTable, { type Col } from "@/components/MetricsTable";
import PeriodTabs from "@/components/PeriodTabs";
import ProfitChart from "@/components/ProfitChart";
import StatusFilter, { parseMostrar } from "@/components/StatusFilter";
import { loadAll, loadPagesData } from "@/lib/data";
import { money, num, pct, ratio } from "@/lib/format";
import { groupBy, summarize } from "@/lib/metrics";
import { NO_PAGE, buildResolver, groupByPage, prettyUrl } from "@/lib/pages";
import { addDays, localDate, parsePeriod } from "@/lib/period";
import { requireSession } from "@/lib/session";

const PAGE_COLS: Col[] = [
  { key: "name", label: "Página", format: "name" },
  { key: "campaigns", label: "Campanhas", format: "int" },
  { key: "active_ads", label: "Criativos ativos", format: "int" },
  { key: "spend", label: "Gasto", format: "money" },
  { key: "sales", label: "Vendas", format: "int" },
  { key: "revenue", label: "Faturamento", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "profit", label: "Lucro", format: "profit" },
  { key: "situation", label: "Situação", format: "situation" },
];

const CAMP_COLS: Col[] = [
  { key: "name", label: "Campanha", format: "name" },
  { key: "spend", label: "Gasto", format: "money" },
  { key: "sales", label: "Vendas", format: "int" },
  { key: "revenue", label: "Faturamento", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "profit", label: "Lucro", format: "profit" },
  { key: "cpa", label: "CPA", format: "money2" },
  { key: "situation", label: "Situação", format: "situation" },
];

const AD_COLS: Col[] = [
  { key: "name", label: "Criativo", format: "name" },
  { key: "ad_status", label: "Status", format: "adstatus" },
  { key: "spend", label: "Gasto", format: "money" },
  { key: "sales", label: "Vendas", format: "int" },
  { key: "revenue", label: "Faturamento", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "profit", label: "Lucro", format: "profit" },
  { key: "ctr", label: "CTR", format: "pct" },
  { key: "situation", label: "Situação", format: "situation" },
];

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PaginasPage({ searchParams }: PageProps<"/paginas">) {
  await requireSession();
  const sp = await searchParams;
  const range = parsePeriod(sp);
  const pagina = one(sp.pagina);

  // busca ao menos 7 dias para o gráfico do sub-resumo
  const fetchSince = [range.since, addDays(range.until, -6)].sort()[0];
  const [{ sales, insights, ads, settings }, pagesData] = await Promise.all([
    loadAll(fetchSince, range.until),
    loadPagesData(),
  ]);
  const resolver = buildResolver(ads, pagesData.pages, pagesData.productPages);
  const inRange = (d: string) => d >= range.since && d <= range.until;
  const curIns = insights.filter((i) => inRange(i.date));
  const curSales = sales.filter((s) => inRange(localDate(s.created_at)));

  const migration = pagesData.needsMigration ? (
    <div className="err-msg">
      Para usar as páginas, falta atualizar o banco: no Supabase, abra <b>SQL Editor → New query</b>, cole o trecho
      &quot;páginas de venda&quot; do arquivo <code>supabase/schema.sql</code> e clique em <b>Run</b>. Depois clique no ↻ do
      Resumo para buscar o link de destino dos anúncios.
    </div>
  ) : null;

  // ---------- lista de páginas ----------
  if (!pagina) {
    const all = groupByPage(curIns, curSales, ads, resolver, settings);
    const rows = all.filter((r) => r.id !== NO_PAGE);
    const none = all.find((r) => r.id === NO_PAGE);
    const totals = summarize(curIns, curSales, settings);
    const noLinks = ads.length > 0 && ads.every((a) => !a.link_url);
    return (
      <div className="stack">
        {migration}
        <div className="row-between">
          <PeriodTabs range={range} base="/paginas" />
        </div>
        <div className="card">
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Páginas de venda</h2>
            <Link href="/configuracoes#paginas" className="faint" style={{ textDecoration: "underline" }}>
              Dar nomes, juntar páginas e ligar produtos
            </Link>
          </div>
          <MetricsTable
            columns={PAGE_COLS}
            rows={rows.map((r) => ({ ...r, parent: r.url }))}
            totals={totals}
            linkTemplate={`/paginas?${range.query}&pagina={id}`}
            emptyText="Nenhuma página com gasto ou venda neste período."
          />
          {none ? (
            <p className="small" style={{ marginTop: 10 }}>
              <Link href={`/paginas?${range.query}&pagina=${NO_PAGE}`} style={{ textDecoration: "underline" }}>
                Sem página identificada
              </Link>
              : {num(none.sales)} venda{none.sales === 1 ? "" : "s"} · {money(none.revenue)} de faturamento
              {none.spend > 0 ? ` · ${money(none.spend)} de gasto em anúncios sem link` : ""} (já incluído no total).
            </p>
          ) : null}
          <p className="faint" style={{ marginTop: 10 }}>
            Cada anúncio entra na página do seu link de destino no Meta. Vendas entram pela UTM do anúncio ou, sem UTM, pelo
            produto ligado à página em Configurações. Clique numa página para abrir o resumo dela.
          </p>
          {noLinks && !pagesData.needsMigration ? (
            <p className="faint" style={{ marginTop: 6 }}>
              Nenhum anúncio tem link de destino ainda: clique no ↻ do Resumo para buscá-los no Meta.
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  // ---------- sub-resumo de uma página ----------
  const ofPage = (adId: string) => resolver.ofAd(adId) === pagina;
  const pIns = insights.filter((i) => ofPage(i.ad_id));
  const pSales = sales.filter((s) => resolver.ofSale(s) === pagina);
  const pCurIns = pIns.filter((i) => inRange(i.date));
  const pCurSales = pSales.filter((s) => inRange(localDate(s.created_at)));
  const cur = summarize(pCurIns, pCurSales, settings);
  const pAds = ads.filter((a) => ofPage(a.ad_id));
  const activeAds = pAds.filter((a) => String(a.status).toUpperCase() === "ACTIVE").length;

  const campaigns = groupBy("campanha", pCurIns, pCurSales, pAds, settings);
  const mostrar = parseMostrar(sp.mostrar);
  const allCreatives = groupBy("anuncio", pCurIns, pCurSales, pAds, settings)
    .filter((r) => r.spend > 0 || r.sales > 0)
    .map((r) => ({ ...r, show_thumb: true }));
  const creatives = mostrar === "ativos" ? allCreatives.filter((r) => r.ad_status === "ativo") : allCreatives;
  const shownIds = new Set(creatives.map((r) => r.id));
  const creativeTotals = summarize(
    pCurIns.filter((i) => shownIds.has(i.ad_id)),
    pCurSales.filter((s) => s.ad_id && shownIds.has(s.ad_id)),
    settings,
  );
  const untracked = pCurSales.filter((s) => s.status === "paid" && !s.ad_id).length;
  const pending = pCurSales.filter((s) => s.status === "unpaid").length;
  const verdict = cur.spend === 0 && cur.sales === 0 ? "neutral" : cur.profit >= 0 ? "good" : "bad";
  const selfHref = `/paginas?${range.query}&pagina=${encodeURIComponent(pagina)}`;

  return (
    <div className="stack">
      {migration}
      <div>
        <Link href={`/paginas?${range.query}`} className="faint" style={{ textDecoration: "underline" }}>← Todas as páginas</Link>
      </div>
      <div className="row-between">
        <PeriodTabs range={range} base="/paginas" keep={{ pagina, mostrar: mostrar === "ativos" ? "ativos" : undefined }} />
      </div>
      <div>
        <h1>{resolver.name(pagina)}</h1>
        <p className="faint">
          {prettyUrl(pagina)}
          {pagina !== NO_PAGE ? ` · ${campaigns.filter((c) => c.spend > 0).length} campanhas · ${activeAds} criativos ativos` : ""}
        </p>
      </div>

      <div className={`verdict ${verdict}`}>
        <span className="icon">{verdict === "good" ? "▲" : verdict === "bad" ? "▼" : "•"}</span>
        <div>
          <p className="big">
            {verdict === "neutral"
              ? `Sem gasto e sem vendas em ${range.label.toLowerCase()}.`
              : `${cur.profit >= 0 ? "Esta página está no lucro" : "Esta página está no prejuízo"}: ${money(cur.profit)}`}
          </p>
          {verdict !== "neutral" && cur.roas !== null ? (
            <p className="small">Cada R$ 1 investido voltou R$ {ratio(cur.roas)}. Período: {range.label}.</p>
          ) : null}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi"><p className="lb">Gasto</p><p className="vl">{money(cur.spend)}</p></div>
        <div className="kpi"><p className="lb">Faturamento</p><p className="vl">{money(cur.revenue)}</p></div>
        <div className="kpi"><p className="lb">Lucro</p><p className={`vl ${cur.profit >= 0 ? "pos" : "neg"}`}>{money(cur.profit)}</p><span className="sub">ROI {pct(cur.roi, 0)}</span></div>
        <div className="kpi"><p className="lb">ROAS</p><p className="vl">{ratio(cur.roas)}</p></div>
        <div className="kpi"><p className="lb">Vendas pagas</p><p className="vl">{num(cur.sales)}</p><span className="sub">CPA {money(cur.cpa, true)}</span></div>
        <div className="kpi"><p className="lb">Pix/boleto pendente</p><p className="vl warn">{num(pending)}</p></div>
      </div>

      <ProfitChart range={range} insights={pIns} sales={pSales} settings={settings} />

      {pagina !== NO_PAGE ? (
        <div className="card">
          <h2>Campanhas desta página</h2>
          <MetricsTable
            columns={CAMP_COLS}
            rows={campaigns}
            linkTemplate={`/anuncios?${range.query}&nivel=conjunto&campanha={id}`}
            emptyText="Nenhuma campanha com gasto ou venda neste período."
          />
        </div>
      ) : null}

      {pagina !== NO_PAGE ? (
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Criativos desta página</h2>
            <StatusFilter
              href={selfHref}
              current={mostrar}
              activeCount={allCreatives.filter((r) => r.ad_status === "ativo").length}
              totalCount={allCreatives.length}
            />
          </div>
          <MetricsTable columns={AD_COLS} rows={creatives} totals={creativeTotals} emptyText="Nenhum criativo neste filtro." />
        </div>
      ) : null}

      {untracked > 0 ? (
        <p className="faint">
          {untracked} venda{untracked > 1 ? "s" : ""} paga{untracked > 1 ? "s" : ""} sem UTM {pagina === NO_PAGE ? "e sem produto ligado a uma página" : "entraram nesta página pelo produto"}.
          {pagina === NO_PAGE ? " Ligue o produto a uma página em Configurações → Páginas de venda." : ""}
        </p>
      ) : null}
    </div>
  );
}
