import Link from "next/link";
import MetricsTable, { type Col } from "@/components/MetricsTable";
import PeriodTabs from "@/components/PeriodTabs";
import { loadAll } from "@/lib/data";
import { localDate, parsePeriod } from "@/lib/period";
import { groupBy, summarize, type Level } from "@/lib/metrics";
import { requireSession } from "@/lib/session";

const LEVELS: { key: Level; label: string }[] = [
  { key: "campanha", label: "Campanhas" },
  { key: "conjunto", label: "Conjuntos" },
  { key: "anuncio", label: "Anúncios" },
];

const COLS: Col[] = [
  { key: "name", label: "Nome", format: "name" },
  { key: "spend", label: "Gasto", format: "money" },
  { key: "sales", label: "Vendas", format: "int" },
  { key: "revenue", label: "Faturamento", format: "money" },
  { key: "roas", label: "ROAS", format: "ratio" },
  { key: "profit", label: "Lucro", format: "profit" },
  { key: "roi", label: "ROI", format: "pct" },
  { key: "cpa", label: "CPA", format: "money2" },
  { key: "ctr", label: "CTR", format: "pct" },
  { key: "situation", label: "Situação", format: "situation" },
];

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function AnunciosPage({ searchParams }: PageProps<"/anuncios">) {
  await requireSession();
  const sp = await searchParams;
  const range = parsePeriod(sp.periodo);
  const level = (LEVELS.find((l) => l.key === one(sp.nivel))?.key ?? "campanha") as Level;
  const campanha = one(sp.campanha);
  const conjunto = one(sp.conjunto);

  const { sales, insights, ads, settings } = await loadAll(range.since, range.until);
  const curSales = sales.filter((s) => localDate(s.created_at) >= range.since);

  // filtro de drill-down
  const ins = insights.filter(
    (i) => (!campanha || i.campaign_id === campanha) && (!conjunto || i.adset_id === conjunto),
  );
  const adIds = new Set(ins.map((i) => i.ad_id));
  const filteredSales = campanha || conjunto ? curSales.filter((s) => s.ad_id && adIds.has(s.ad_id)) : curSales;

  const rows = groupBy(level, ins, filteredSales, ads, settings);
  const attributed = filteredSales.filter((s) => s.ad_id && adIds.has(s.ad_id));
  const totals = summarize(ins, attributed, settings);

  const campName = campanha ? insights.find((i) => i.campaign_id === campanha)?.campaign_name : null;
  const setName = conjunto ? insights.find((i) => i.adset_id === conjunto)?.adset_name : null;
  const keep = { nivel: level, campanha, conjunto };
  const next =
    level === "campanha" ? `/anuncios?periodo=${range.key}&nivel=conjunto&campanha={id}`
    : level === "conjunto" ? `/anuncios?periodo=${range.key}&nivel=anuncio${campanha ? `&campanha=${campanha}` : ""}&conjunto={id}`
    : undefined;

  return (
    <div className="stack">
      <div className="row-between">
        <PeriodTabs current={range.key} base="/anuncios" keep={keep} />
      </div>
      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div className="tabs">
            {LEVELS.map((l) => (
              <Link key={l.key} href={`/anuncios?periodo=${range.key}&nivel=${l.key}`} className={l.key === level && !campanha && !conjunto ? "on" : l.key === level ? "on" : ""}>
                {l.label}
              </Link>
            ))}
          </div>
          <span className="faint">
            {campName || setName ? (
              <>
                Filtrando: {[campName, setName].filter(Boolean).join(" › ")} ·{" "}
                <Link href={`/anuncios?periodo=${range.key}&nivel=${level}`} style={{ textDecoration: "underline" }}>limpar</Link>
              </>
            ) : next ? "Clique numa linha para abrir o próximo nível" : `${range.label} · ordenado por lucro`}
          </span>
        </div>
        <MetricsTable columns={COLS} rows={rows} totals={totals} linkTemplate={next} />
        <p className="faint" style={{ marginTop: 10 }}>
          Situação: ROI abaixo de {settings.roi_pause}% = Pausar · abaixo de {settings.roi_attention}% = Atenção · a partir de {settings.roi_scale}% = Escalar.
          Com gasto abaixo de R$ {settings.min_spend_to_judge} e sem lucro ainda = Aprendendo. Ajuste em Configurações.
        </p>
      </div>
    </div>
  );
}
