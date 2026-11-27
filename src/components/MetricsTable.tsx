"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { money, num, pct, ratio } from "@/lib/format";
import { AD_STATUS_LABEL, AD_STATUS_ORDER, adStatusDetail, type AdStatusKey } from "@/lib/adStatus";

export type ColFormat = "money" | "money2" | "int" | "pct" | "ratio" | "profit" | "situation" | "adstatus" | "name";

export interface Col {
  key: string;
  label: string;
  format: ColFormat;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>;

const SIT: Record<string, { label: string; cls: string }> = {
  escalar: { label: "Escalar", cls: "green" },
  bom: { label: "Bom", cls: "green" },
  atencao: { label: "Atenção", cls: "amber" },
  pausar: { label: "Pausar", cls: "red" },
  aprendendo: { label: "Aprendendo", cls: "gray" },
};
const AD_STATUS_CLS: Record<AdStatusKey, string> = {
  ativo: "blue", pausado: "gray", analise: "amber", reprovado: "red", problema: "red", arquivado: "gray", desconhecido: "gray",
};

const SIT_ORDER: Record<string, number> = { escalar: 4, bom: 3, atencao: 2, aprendendo: 1, pausar: 0 };

function Cell({ row, col }: { row: R; col: Col }) {
  const v = row[col.key];
  switch (col.format) {
    case "name":
      return (
        <>
          {row.show_thumb ? (
            row.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="thumb" src={row.thumbnail_url} alt="" />
            ) : (
              <span className="thumb">{row.creative_type === "video" ? "▶" : "▢"}</span>
            )
          ) : null}
          <span>{v}</span>
          {row.parent ? <span className="sub-name">{row.parent}</span> : null}
        </>
      );
    case "money": return <>{money(v)}</>;
    case "money2": return <>{money(v, true)}</>;
    case "int": return <>{num(v)}</>;
    case "pct": return <>{pct(v)}</>;
    case "ratio": return <>{ratio(v)}</>;
    case "profit":
      return <span className={v >= 0 ? "pos" : "neg"}>{money(v)}</span>;
    case "adstatus": {
      const k = (v ?? "desconhecido") as AdStatusKey;
      return (
        <span className={`pill ${AD_STATUS_CLS[k]}`} title={adStatusDetail(row.ad_status_raw)}>
          {k === "ativo" ? "● " : ""}{AD_STATUS_LABEL[k]}
        </span>
      );
    }
    case "situation": {
      const s = SIT[v] ?? SIT.aprendendo;
      return <span className={`pill ${s.cls}`}>{s.label}</span>;
    }
  }
}

export default function MetricsTable({
  columns,
  rows,
  totals,
  defaultSort = "profit",
  linkTemplate,
  funnel = false,
  emptyText = "Nada para mostrar neste período.",
}: {
  columns: Col[];
  rows: R[];
  totals?: R;
  defaultSort?: string;
  /** Ex.: "/anuncios?nivel=conjunto&campanha={id}" — clique na linha abre o próximo nível. */
  linkTemplate?: string;
  /** Mostra o funil do criativo selecionado abaixo da tabela. */
  funnel?: boolean;
  emptyText?: string;
}) {
  const router = useRouter();
  const [key, setKey] = useState(defaultSort);
  const [dir, setDir] = useState<1 | -1>(-1);
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === key);
    return [...rows].sort((a, b) => {
      let x = a[key];
      let y = b[key];
      if (col?.format === "situation") {
        x = SIT_ORDER[x] ?? 0;
        y = SIT_ORDER[y] ?? 0;
      } else if (col?.format === "adstatus") {
        x = AD_STATUS_ORDER[x as AdStatusKey] ?? 0;
        y = AD_STATUS_ORDER[y as AdStatusKey] ?? 0;
      }
      if (typeof x === "string" || typeof y === "string") return dir * String(x ?? "").localeCompare(String(y ?? ""), "pt-BR");
      x = x ?? -Infinity;
      y = y ?? -Infinity;
      return dir * (x - y);
    });
  }, [rows, key, dir, columns]);

  const sel = funnel ? sorted.find((r) => r.id === selected) ?? sorted[0] : null;

  function sortBy(k: string) {
    if (k === key) setDir(dir === 1 ? -1 : 1);
    else {
      setKey(k);
      setDir(columns.find((c) => c.key === k)?.format === "name" ? 1 : -1);
    }
  }

  if (rows.length === 0) return <p className="muted small" style={{ padding: "12px 0" }}>{emptyText}</p>;

  return (
    <>
      <div className="table-wrap">
        <table className="t">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`sortable ${c.format === "name" ? "left" : ""}`} onClick={() => sortBy(c.key)}>
                  {c.label}
                  {c.key === key ? (dir === -1 ? " ↓" : " ↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr
                key={r.id}
                className={`${linkTemplate || funnel ? "click" : ""} ${sel && sel.id === r.id ? "sel" : ""}`}
                onClick={() => {
                  if (linkTemplate) router.push(linkTemplate.replace("{id}", encodeURIComponent(r.id)));
                  else if (funnel) setSelected(r.id);
                }}
              >
                {columns.map((c) => (
                  <td key={c.key} className={c.format === "name" ? "left name" : ""}>
                    <Cell row={r} col={c} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals ? (
            <tfoot>
              <tr>
                {columns.map((c, i) => (
                  <td key={c.key} className={i === 0 ? "left" : ""}>
                    {i === 0 ? "Total" : c.format === "situation" || c.format === "adstatus" || totals[c.key] === undefined ? "" : <Cell row={totals} col={c} />}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {sel ? <Funnel row={sel} /> : null}
    </>
  );
}

function Funnel({ row }: { row: R }) {
  const steps: [string, number][] = [
    ["Impressões", row.impressions],
    ["Cliques no link", row.link_clicks],
    ["Viram a página", row.landing_page_views],
    ["Iniciaram checkout", row.initiate_checkouts],
    ["Compraram (Wiapy)", row.sales],
  ];
  const max = Math.max(1, steps[0][1]);
  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Funil: {row.name}</h2>
        <span className="faint">Clique em outra linha para trocar o criativo</span>
      </div>
      <div className="mini-kpis">
        <div><p className="lb">CPM</p><p className="vl">{money(row.cpm, true)}</p></div>
        <div><p className="lb">CPC</p><p className="vl">{money(row.cpc, true)}</p></div>
        <div><p className="lb">CPA</p><p className="vl">{money(row.cpa, true)}</p></div>
        <div><p className="lb">Retenção 3s</p><p className="vl">{pct(row.hook)}</p></div>
        <div><p className="lb">ThruPlay</p><p className="vl">{pct(row.thruplay_rate)}</p></div>
        <div><p className="lb">Conversão da página</p><p className="vl">{pct(row.page_conversion)}</p></div>
      </div>
      {steps.map(([label, value], i) => {
        const w = Math.max(22, Math.round(Math.sqrt((value || 0) / max) * 100));
        const prev = i > 0 ? steps[i - 1][1] : 0;
        const conv = i > 0 && prev > 0 ? ` · ${pct((value / prev) * 100)} da etapa anterior` : "";
        return (
          <div key={label} className="funnel-step" style={{ width: `${w}%` }}>
            {label}: {num(value)}{conv}
          </div>
        );
      })}
    </div>
  );
}
