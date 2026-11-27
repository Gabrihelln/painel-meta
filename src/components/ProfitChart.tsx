import { money } from "@/lib/format";
import { profitByDay } from "@/lib/metrics";
import { addDays, listDays, localDate, shortDayLabel, type Range } from "@/lib/period";
import type { AdInsight, Sale, Settings } from "@/lib/types";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Day = { date: string; profit: number; revenue: number; spend: number; sales: number };

function byMonth(days: Day[]) {
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

/**
 * Gráfico de lucro por dia (ou por mês acima de 62 dias).
 * Mostra no mínimo 7 dias; em "Todos" começa no primeiro dado existente.
 * Recebe insights/vendas cobrindo pelo menos os 7 dias até `range.until`.
 */
export default function ProfitChart({
  range,
  insights,
  sales,
  settings,
}: {
  range: Range;
  insights: AdInsight[];
  sales: Sale[];
  settings: Settings;
}) {
  const today = localDate(new Date());
  const minStart = addDays(range.until, -6);
  const firstData = [...sales.map((s) => localDate(s.created_at)), ...insights.map((i) => i.date)].reduce(
    (a, b) => (b < a ? b : a),
    range.until,
  );
  const start = [range.key === "todos" ? firstData : range.since, minStart].sort()[0];
  const daily = profitByDay(listDays(start, range.until), insights, sales, settings);
  const monthly = daily.length > 62;
  const bars = monthly ? byMonth(daily) : daily.map((d) => ({ ...d, key: d.date, label: shortDayLabel(d.date, today) }));
  const maxAbs = Math.max(1, ...bars.map((d) => Math.abs(d.profit)));
  const hasNeg = bars.some((d) => d.profit < 0);
  const posH = hasNeg ? 110 : 150;
  const negH = hasNeg ? 40 : 0;
  const labelEvery = bars.length > 14 ? Math.ceil(bars.length / 10) : 1;

  return (
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
  );
}
