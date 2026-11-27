import Link from "next/link";
import PeriodTabs from "@/components/PeriodTabs";
import { loadAll } from "@/lib/data";
import { dateTimeBR, money, timeBR } from "@/lib/format";
import { parsePeriod } from "@/lib/period";
import { requireSession } from "@/lib/session";
import { METHOD_LABEL, STATUS_LABEL } from "@/lib/wiapy";

const FILTERS = [
  { key: "todas", label: "Todas", match: () => true },
  { key: "pagas", label: "Pagas", match: (s: string) => s === "paid" },
  { key: "pendentes", label: "Pix/boleto pendente", match: (s: string) => s === "unpaid" },
  { key: "recusadas", label: "Recusadas", match: (s: string) => s === "credit_card_declined" },
  { key: "reembolsos", label: "Reembolsos", match: (s: string) => s === "refunded" || s === "chargedback" },
];

const PILL: Record<string, string> = {
  paid: "green",
  unpaid: "amber",
  credit_card_declined: "red",
  refunded: "red",
  chargedback: "red",
};

const LIMIT = 300;

export default async function VendasPage({ searchParams }: PageProps<"/vendas">) {
  await requireSession();
  const sp = await searchParams;
  const range = parsePeriod(sp);
  const fKey = (Array.isArray(sp.status) ? sp.status[0] : sp.status) ?? "todas";
  const filter = FILTERS.find((f) => f.key === fKey) ?? FILTERS[0];

  const { sales, insights, ads } = await loadAll(range.since, range.until);
  const adName = new Map<string, string>();
  for (const a of ads) if (a.ad_name) adName.set(a.ad_id, a.ad_name);
  for (const i of insights) if (i.ad_name) adName.set(i.ad_id, i.ad_name);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, sales.filter((s) => f.match(s.status)).length]));
  const list = sales.filter((s) => filter.match(s.status));
  const multiDay = range.since !== range.until;

  return (
    <div className="stack">
      <div className="row-between">
        <PeriodTabs range={range} base="/vendas" keep={{ status: fKey }} />
      </div>
      <div className="card">
        <div className="tabs" style={{ marginBottom: 10 }}>
          {FILTERS.map((f) => (
            <Link key={f.key} href={`/vendas?${range.query}&status=${f.key}`} className={f.key === filter.key ? "on" : ""}>
              {f.label} ({counts[f.key]})
            </Link>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="muted small" style={{ padding: "12px 0" }}>Nenhuma venda neste filtro.</p>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead>
                <tr>
                  <th className="left">{multiDay ? "Data" : "Hora"}</th>
                  <th className="left">Cliente</th>
                  <th className="left">Veio do anúncio</th>
                  <th className="left">Produto</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.slice(0, LIMIT).map((s) => (
                  <tr key={s.id}>
                    <td className="left">{multiDay ? dateTimeBR(s.created_at) : timeBR(s.created_at)}</td>
                    <td className="left name">{s.customer_name ?? "—"}</td>
                    <td className="left name">
                      {s.ad_id ? (adName.get(s.ad_id) ?? `Anúncio ${s.ad_id}`) : <span className="muted">Sem rastreio</span>}
                      {s.utm_campaign && !s.ad_id ? <span className="sub-name">{s.utm_campaign}</span> : null}
                    </td>
                    <td className="left name">
                      {s.product_titles ?? s.checkout_title ?? "—"}
                      {s.orderbump_cents > 0 ? <span className="sub-name">com order bump</span> : null}
                    </td>
                    <td>{money(s.amount_cents / 100, true)}</td>
                    <td>
                      <span className={`pill ${PILL[s.status] ?? "gray"}`}>
                        {STATUS_LABEL[s.status] ?? s.status}
                        {s.payment_method ? ` · ${METHOD_LABEL[s.payment_method] ?? s.payment_method}` : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.length > LIMIT ? <p className="faint" style={{ marginTop: 8 }}>Mostrando as {LIMIT} mais recentes de {list.length}.</p> : null}
      </div>
      <p className="faint">&quot;Sem rastreio&quot; é venda que chegou sem UTM de anúncio (orgânico, link direto, outro dispositivo).</p>
    </div>
  );
}
