import PeriodTabs from "@/components/PeriodTabs";
import { loadAll } from "@/lib/data";
import { changePct, dateTimeBR, money, num, pct, ratio } from "@/lib/format";
import { groupBy, profitByDay, summarize } from "@/lib/metrics";
import { addDays, daysBetween, listDays, localDate, parsePeriod, previousRange, sameTimeYesterdayMs, shortDayLabel } from "@/lib/period";
import { requireSession } from "@/lib/session";

function Change({ now, before, invert = false, label = "vs período anterior" }: { now: number; before: number; invert?: boolean; label?: string }) {
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
  const range = parsePeriod(sp.periodo);
  const prev = previousRange(range);
  const today = localDate(new Date());

  // gráfico: pelo menos 7 dias, no máximo 31
  const n = Math.min(31, Math.max(7, daysBetween(range.since, range.until)));
  const chartSince = addDays(range.until, -(n - 1));
  const fetchSince = [prev.since, chartSince].sort()[0];

  const { sales, insights, ads, settings } = await loadAll(fetchSince, range.until);
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const curSales = sales.filter((s) => inRange(localDate(s.created_at), range.since, range.until));
  // "Hoje" compara com ontem até a mesma hora (vendas). O gasto do Meta vem por dia inteiro.
  const sameTimeYesterday = sameTimeYesterdayMs();
  const prevSales = sales.filter(
    (s) => inRange(localDate(s.created_at), prev.since, prev.until) &&
      (range.key !== "hoje" || Date.parse(s.created_at) <= sameTimeYesterday),
  );
  const curIns = insights.filter((i) => inRange(i.date, range.since, range.until));
  const prevIns = insights.filter((i) => inRange(i.date, prev.since, prev.until));

  const cur = summarize(curIns, curSales, settings);
  const before = summarize(prevIns, prevSales, settings);

  const pending = curSales.filter((s) => s.status === "unpaid");
  const pendingValue = pending.reduce((a, s) => a + s.amount_cents / 100, 0);
  const refunds = curSales.filter((s) => s.status === "refunded" || s.status === "chargedback").length;
  const untracked = curSales.filter((s) => s.status === "paid" && !s.ad_id).length;

  const creatives = groupBy("anuncio", curIns, curSales, ads, settings).filter((r) => r.spend > 0);
  const best = creatives[0];
  const worst = [...creatives].sort((a, b) => a.profit - b.profit)[0];

  const days = profitByDay(listDays(chartSince, range.until), insights, sales, settings);
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.profit)));
  const hasNeg = days.some((d) => d.profit < 0);
  const posH = hasNeg ? 110 : 150;
  const negH = hasNeg ? 40 : 0;

  const periodWord = range.key === "hoje" ? "hoje" : range.key === "ontem" ? "ontem" : `nos últimos ${daysBetween(range.since, range.until)} dias`;
  const verdictClass = cur.spend === 0 && cur.sales === 0 ? "neutral" : cur.profit >= 0 ? "good" : "bad";

  return (
    <div className="stack">
      <div className="row-between">
        <PeriodTabs current={range.key} base="/" />
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
          <Change now={cur.revenue} before={before.revenue} label={range.key === "hoje" ? "vs ontem até esta hora" : undefined} />
        </div>
        <div className="kpi">
          <p className="lb">Gasto em anúncios</p>
          <p className="vl">{money(cur.spend)}</p>
          {range.key === "hoje"
            ? <span className="sub">ontem inteiro: {money(before.spend)}</span>
            : <Change now={cur.spend} before={before.spend} invert />}
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
          <h2 style={{ margin: 0 }}>Lucro por dia</h2>
          <span className="faint">Verde: lucro · Vermelho: prejuízo</span>
        </div>
        <div className="bars" style={{ height: posH + negH + 1 }}>
          {days.map((d) => (
            <div className="bar-col" key={d.date} title={`${d.date}: lucro ${money(d.profit)} · faturamento ${money(d.revenue)} · gasto ${money(d.spend)} · ${d.sales} vendas`}>
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
          {days.map((d, i) => (
            <span key={d.date} className={d.profit < 0 ? "neg" : ""}>
              {n > 14 && i % 3 !== 0 && d.date !== today ? "" : shortDayLabel(d.date, today)}
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
