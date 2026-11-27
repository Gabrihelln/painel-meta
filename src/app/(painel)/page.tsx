import Link from "next/link";
import MetricsTable, { type Col } from "@/components/MetricsTable";
import PeriodTabs from "@/components/PeriodTabs";
import StatusFilter, { parseMostrar } from "@/components/StatusFilter";
import RefreshButton from "@/components/RefreshButton";
import ProfitChart from "@/components/ProfitChart";
import { loadAll } from "@/lib/data";
import { changePct, dateTimeBR, money, num, pct, ratio } from "@/lib/format";
import { groupBy, summarize } from "@/lib/metrics";
import { ALL_SINCE, addDays, daysBetween, localDate, parsePeriod, previousRange, sameTimeYesterdayMs } from "@/lib/period";
import { requireSession } from "@/lib/session";

const RESUMO_COLS: Col[] = [
  { key: "name", label: "Criativo", format: "name" },
  { key: "ad_status", label: "Status", format: "adstatus" },
  { key: "spend", label: "Gasto", format: "money" },
  { key: "sales", label: "Vendas", format: "int" },
  { key: "revenue", label: "Faturamento", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "profit", label: "Lucro", format: "profit" },
  { key: "cpa", label: "CPA", format: "money2" },
  { key: "ctr", label: "CTR", format: "pct" },
  { key: "situation", label: "Situação", format: "situation" },
];

function Change({ now, before, invert = false, label = "vs período anterior" }: { now: number; before: number | undefined; invert?: boolean; label?: string }) {
  if (before === undefined) return <span className="sub">desde o início</span>;
  const c = changePct(now, before);
  if (c === null) return <span className="sub">sem comparação</span>;
  const good = invert ? c <= 0 : c >= 0;
  return (
    <span className={`sub ${good ? "pos" : "neg"}`}>
      {c >= 0 ? "+" : ""}{pct(c, 0)} {label}
    </span>
  );
}

export default async function ResumoPage({ searchParams }: PageProps<"/">) {
  await requireSession();
  const sp = await searchParams;
  const range = parsePeriod(sp);
  const isAll = range.key === "todos";
  const prev = isAll ? null : previousRange(range);

  // "Todos" busca tudo; os outros períodos buscam também o período anterior (comparação)
  // e pelo menos 7 dias para o gráfico.
  const minChartSince = addDays(range.until, -6);
  const fetchSince = isAll ? ALL_SINCE : [prev!.since, range.since, minChartSince].sort()[0];

  const { sales, insights, ads, settings } = await loadAll(fetchSince, range.until);
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const curSales = sales.filter((s) => inRange(localDate(s.created_at), range.since, range.until));
  const curIns = insights.filter((i) => inRange(i.date, range.since, range.until));
  const cur = summarize(curIns, curSales, settings);

  let before: ReturnType<typeof summarize> | null = null;
  if (prev) {
    // "Hoje" compara com ontem até a mesma hora (vendas). O gasto do Meta vem por dia inteiro.
    const sameTimeYesterday = sameTimeYesterdayMs();
    const prevSales = sales.filter(
      (s) => inRange(localDate(s.created_at), prev.since, prev.until) &&
        (range.key !== "hoje" || Date.parse(s.created_at) <= sameTimeYesterday),
    );
    const prevIns = insights.filter((i) => inRange(i.date, prev.since, prev.until));
    before = summarize(prevIns, prevSales, settings);
  }

  const pending = curSales.filter((s) => s.status === "unpaid");
  const pendingValue = pending.reduce((a, s) => a + s.amount_cents / 100, 0);
  const refunds = curSales.filter((s) => s.status === "refunded" || s.status === "chargedback").length;
  const untracked = curSales.filter((s) => s.status === "paid" && !s.ad_id).length;

  const allCreatives = groupBy("anuncio", curIns, curSales, ads, settings);
  const creatives = allCreatives.filter((r) => r.spend > 0);
  // tabela do Resumo: criativos com gasto ou venda no período
  const mostrar = parseMostrar(sp.mostrar);
  const withData = allCreatives
    .filter((r) => r.spend > 0 || r.sales > 0)
    .map((r) => ({ ...r, show_thumb: true }));
  const activeCount = withData.filter((r) => r.ad_status === "ativo").length;
  const creativeRows = mostrar === "ativos" ? withData.filter((r) => r.ad_status === "ativo") : withData;
  const shownIds = new Set(creativeRows.map((r) => r.id));
  const creativeTotals = summarize(
    curIns.filter((i) => shownIds.has(i.ad_id)),
    curSales.filter((s) => s.ad_id && shownIds.has(s.ad_id)),
    settings,
  );
  const best = creatives[0];
  const worst = [...creatives].sort((a, b) => a.profit - b.profit)[0];


  const periodWord =
    range.key === "hoje" ? "hoje"
    : range.key === "ontem" ? "ontem"
    : range.key === "mes" ? "este mês"
    : isAll ? "no total"
    : range.key === "personalizado" ? (range.since === range.until ? `em ${range.label}` : `de ${range.label}`)
    : `nos últimos ${daysBetween(range.since, range.until)} dias`;
  const verdictClass = cur.spend === 0 && cur.sales === 0 ? "neutral" : cur.profit >= 0 ? "good" : "bad";

  return (
    <div className="stack">
      <div className="row-between">
        <PeriodTabs range={range} base="/" keep={{ mostrar: mostrar === "ativos" ? "ativos" : undefined }} />
        <RefreshButton
          lastSync={settings.last_meta_sync_at ? `Meta atualizado em ${dateTimeBR(settings.last_meta_sync_at)}` : "Meta ainda não sincronizado"}
        />
      </div>

      <div className={`verdict ${verdictClass}`}>
        <span className="icon">{verdictClass === "good" ? "▲" : verdictClass === "bad" ? "▼" : "•"}</span>
        <div>
          <p className="big">
            {verdictClass === "neutral"
              ? `Sem vendas e sem gasto ${periodWord}.`
              : cur.profit >= 0
                ? `Você está no lucro ${periodWord}: ${money(cur.profit)}`
                : `Você está no prejuízo ${periodWord}: ${money(cur.profit)}`}
          </p>
          {verdictClass !== "neutral" ? (
            <p className="small">
              {cur.roas !== null ? `Cada R$ 1 investido voltou R$ ${ratio(cur.roas)}. ` : ""}
              {best ? `Melhor criativo: ${best.name}. ` : ""}
              {worst && worst.profit < 0 && worst.id !== best?.id ? `Pior: ${worst.name} (${money(worst.profit)}).` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="kpis">
        <div className="kpi">
          <p className="lb">Faturamento</p>
          <p className="vl">{money(cur.revenue)}</p>
          <Change now={cur.revenue} before={before?.revenue} label={range.key === "hoje" ? "vs ontem até esta hora" : undefined} />
        </div>
        <div className="kpi">
          <p className="lb">Gasto em anúncios</p>
          <p className="vl">{money(cur.spend)}</p>
          {range.key === "hoje" && before
            ? <span className="sub">ontem inteiro: {money(before.spend)}</span>
            : <Change now={cur.spend} before={before?.spend} invert />}
        </div>
        <div className="kpi">
          <p className="lb">Lucro</p>
          <p className={`vl ${cur.profit >= 0 ? "pos" : "neg"}`}>{money(cur.profit)}</p>
          <span className="sub">já sem taxas e impostos</span>
        </div>
        <div className="kpi">
          <p className="lb">ROAS</p>
          <p className="vl">{ratio(cur.roas)}</p>
          <span className="sub">ROI {pct(cur.roi, 0)}</span>
        </div>
        <div className="kpi">
          <p className="lb">Vendas pagas</p>
          <p className="vl">{num(cur.sales)}</p>
          <span className="sub">CPA {money(cur.cpa, true)}{refunds ? ` · ${refunds} reembolso${refunds > 1 ? "s" : ""}` : ""}</span>
        </div>
        <div className="kpi">
          <p className="lb">Pix/boleto pendente</p>
          <p className="vl warn">{num(pending.length)}</p>
          <span className="sub">{money(pendingValue)} a receber</span>
        </div>
      </div>

      <ProfitChart range={range} insights={insights} sales={sales} settings={settings} />

      <div className="card">
        <div className="row-between" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>Como está cada criativo</h2>
            <StatusFilter href={`/?${range.query}`} current={mostrar} activeCount={activeCount} totalCount={withData.length} />
          </div>
          <Link href={`/criativos?${range.query}`} className="faint" style={{ textDecoration: "underline" }}>
            Ver funil e mais métricas
          </Link>
        </div>
        <MetricsTable
          columns={RESUMO_COLS}
          rows={creativeRows}
          totals={creativeTotals}
          emptyText={mostrar === "ativos" ? "Nenhum criativo ativo com gasto ou venda neste período." : "Nenhum anúncio com gasto ou venda neste período."}
        />
      </div>

      {untracked > 0 ? (
        <p className="faint">
          {untracked} venda{untracked > 1 ? "s" : ""} paga{untracked > 1 ? "s" : ""} sem rastreio de anúncio neste período (entram no faturamento, mas não em nenhum criativo).
        </p>
      ) : null}
    </div>
  );
}
