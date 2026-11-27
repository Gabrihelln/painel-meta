import CampaignSelect from "@/components/CampaignSelect";
import MetricsTable, { type Col } from "@/components/MetricsTable";
import PeriodTabs from "@/components/PeriodTabs";
import StatusFilter, { parseMostrar } from "@/components/StatusFilter";
import { loadAll } from "@/lib/data";
import { groupBy, summarize } from "@/lib/metrics";
import { parsePeriod } from "@/lib/period";
import { requireSession } from "@/lib/session";

const COLS: Col[] = [
  { key: "name", label: "Criativo", format: "name" },
  { key: "ad_status", label: "Status", format: "adstatus" },
  { key: "spend", label: "Gasto", format: "money" },
  { key: "sales", label: "Vendas", format: "int" },
  { key: "revenue", label: "Faturamento", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "profit", label: "Lucro", format: "profit" },
  { key: "cpa", label: "CPA", format: "money2" },
  { key: "ctr", label: "CTR", format: "pct" },
  { key: "cpm", label: "CPM", format: "money2" },
  { key: "hook", label: "Ret. 3s", format: "pct" },
  { key: "situation", label: "Situação", format: "situation" },
];

export default async function CriativosPage({ searchParams }: PageProps<"/criativos">) {
  await requireSession();
  const sp = await searchParams;
  const range = parsePeriod(sp);
  const campanha = (Array.isArray(sp.campanha) ? sp.campanha[0] : sp.campanha) ?? "";

  const { sales, insights, ads, settings } = await loadAll(range.since, range.until);
  const campaigns = new Map<string, string>();
  for (const i of insights) if (i.campaign_id) campaigns.set(i.campaign_id, i.campaign_name ?? i.campaign_id);

  const ins = campanha ? insights.filter((i) => i.campaign_id === campanha) : insights;
  const adIds = new Set(ins.map((i) => i.ad_id));
  const attributed = sales.filter((s) => s.ad_id && adIds.has(s.ad_id));
  const mostrar = parseMostrar(sp.mostrar);
  const allRows = groupBy("anuncio", ins, attributed, ads, settings).map((r) => ({ ...r, show_thumb: true }));
  const activeCount = allRows.filter((r) => r.ad_status === "ativo").length;
  const rows = mostrar === "ativos" ? allRows.filter((r) => r.ad_status === "ativo") : allRows;
  const shownIds = new Set(rows.map((r) => r.id));
  const totals = summarize(
    ins.filter((i) => shownIds.has(i.ad_id)),
    attributed.filter((s) => s.ad_id && shownIds.has(s.ad_id)),
    settings,
  );
  const baseHref = `/criativos?${range.query}${campanha ? `&campanha=${encodeURIComponent(campanha)}` : ""}`;

  return (
    <div className="stack">
      <div className="row-between">
        <PeriodTabs range={range} base="/criativos" keep={{ campanha: campanha || undefined, mostrar: mostrar === "ativos" ? "ativos" : undefined }} />
        <CampaignSelect
          options={[...campaigns].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))}
          value={campanha}
          base={`/criativos?${range.query}${mostrar === "ativos" ? "&mostrar=ativos" : ""}`}
        />
      </div>
      <div className="card">
        <div style={{ marginBottom: 10 }}>
          <StatusFilter href={baseHref} current={mostrar} activeCount={activeCount} totalCount={allRows.length} />
        </div>
        <MetricsTable
          columns={COLS}
          rows={rows}
          totals={totals}
          funnel
          emptyText={mostrar === "ativos" ? "Nenhum criativo ativo com dados neste período." : "Nenhum criativo com dados neste período."}
        />
      </div>
      <p className="faint">
        Vendas e faturamento vêm da Wiapy (vendas reais), ligadas ao criativo pela UTM. Gasto, CTR, CPM, retenção e status vêm do Meta (atualizados a cada 15 minutos).
        Clique no nome de uma coluna para ordenar.
      </p>
    </div>
  );
}
