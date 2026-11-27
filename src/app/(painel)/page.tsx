import PeriodTabs from "@/components/PeriodTabs";
import { loadAll } from "@/lib/data";
import { changePct, dateTimeBR, money, num, pct, ratio } from "@/lib/format";
import { groupBy, profitByDay, summarize } from "@/lib/metrics";
import { ALL_SINCE, addDays, daysBetween, listDays, localDate, parsePeriod, previousRange, sameTimeYesterdayMs, shortDayLabel } from "@/lib/period";
import { requireSession } from "@/lib/session";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function byMonth(days: { date: string; profit: number; revenue: number; spend: number; sales: number }[]) {
  const map = new Map<string, { key: string; label: string; profit: number; revenue: number; spend: number; sales: number }>();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    let m = map.get(key);
    if (!m) {
      m = { key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]}/${key.slice(2, 4)}`, profit: 0, revenue: 0, spend: 0, sales: 0 };
      map.set(key, m);
    }
    m.profit += d.profit;
    m.revenue += d.revenue;
    m.spend += d.spend;
    m.sales += d.sales;
  }
  return [...map.values()];
}

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
  const today = localDate(new Date());

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

  const creatives = groupBy("anuncio", curIns, curSales, ads, settings).filter((r) => r.spend > 0);
  const best = creatives[0];
  const worst = [...creatives].sort((a, b) => a.profit - b.profit)[0];

  // gráfico: do início do período (em "Todos", do primeiro dado existente), mínimo 7 dias;
  // acima de 62 dias agrupa por mês.
  const firstData = [
    ...sales.map((s) => localDate(s.created_at)),
    ...insights.map((i) => i.date),
  ].reduce((a, b) => (b < a ? b : a), range.until);
  const chartStart = [isAll ? firstData : range.since, minChartSince].sort()[0];
  const daily = profitByDay(listDays(chartStart, range.until), insights, sales, settings);
  const monthly = daily.length > 62;
  const bars = monthly ? byMonth(daily) : daily.map((d) => ({ ...d, key: d.date, label: shortDayLabel(d.date, today) }));
  const maxAbs = Math.max(1, ...bars.map((d) => Math.abs(d.profit)));
  const hasNeg = bars.some((d) => d.profit < 0);
  const posH = hasNeg ? 110 : 150;
  const negH = hasNeg ? 40 : 0;
  const labelEvery = bars.length > 14 ? Math.ceil(bars.length / 10) : 1;

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
        <PeriodTabs range={range} base="/" />
        <span className="faint">
          {settings.last_meta_sync_at ? `Meta atualizado em ${dateTimeBR(settings.last_meta_sync_at)}` : "Meta ainda não sincronizado"}
        </span>
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

      <div className="card">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{monthly ? "Lucro por mês" : "Lucro por dia"}</h2>
          <span className="faint">Verde: lucro · Vermelho: prejuízo</span>
        </div>
        <div className="bars" style={{ height: posH + negH + 1 }}>
          {bars.map((d) => (
            <div className="bar-col" key={d.key} title={`${d.label}: lucro ${money(d.profit)} · faturamento ${money(d.revenue)} · gasto ${money(d.spend)} · ${d.sales} vendas`}>
              <div className="bar-pos-zone" style={{ height: posH }}>
                {d.profit >= 0 ? <div className="bar" style={{ height: Math.max(2, (d.profit / maxAbs) * posH) }} /> : null}
              </div>
              <div className="bar-axis" />
              {hasNeg ? (
                <div className="bar-neg-zone" style={{ height: negH }}>
                  {d.profit < 0 ? <div className="bar neg" style={{ height: Math.max(2, Math.min(negH, (-d.profit / maxAbs) * posH)) }} /> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="bar-labels">
          {bars.map((d, i) => (
            <span key={d.key} className={d.profit < 0 ? "neg" : ""}>
              {i % labelEvery === 0 || i === bars.length - 1 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>

      {untracked > 0 ? (
        <p className="faint">
          {untracked} venda{untracked > 1 ? "s" : ""} paga{untracked > 1 ? "s" : ""} sem rastreio de anúncio neste período (entram no faturamento, mas não em nenhum criativo).
        </p>
      ) : null}
    </div>
  );
}
