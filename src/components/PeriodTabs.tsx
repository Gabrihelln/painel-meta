"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PERIODS, type Range } from "@/lib/period";

/** Filtro de período: atalhos (Hoje … Todos) + intervalo personalizado com calendário. */
export default function PeriodTabs({
  range,
  base,
  keep = {},
}: {
  range: Range;
  base: string;
  keep?: Record<string, string | undefined>;
}) {
  const router = useRouter();
  const custom = range.key === "personalizado";
  const [open, setOpen] = useState(custom);
  const [de, setDe] = useState(custom ? range.since : "");
  const [ate, setAte] = useState(custom ? range.until : "");
  const [error, setError] = useState("");

  const href = (period: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
    for (const [k, v] of new URLSearchParams(period)) q.set(k, v);
    return `${base}?${q}`;
  };

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!de || !ate) {
      setError("Escolha a data inicial e a final");
      return;
    }
    const [a, b] = de <= ate ? [de, ate] : [ate, de];
    router.push(href(`periodo=personalizado&de=${a}&ate=${b}`));
  }

  return (
    <div className="period">
      <div className="tabs">
        {PERIODS.map((p) => (
          <Link key={p.key} href={href(`periodo=${p.key}`)} className={p.key === range.key ? "on" : ""}>
            {p.label}
          </Link>
        ))}
        <button type="button" className={`tab-btn ${custom ? "on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open}>
          {custom ? range.label : "Personalizado"} ▾
        </button>
      </div>
      {open ? (
        <form className="custom-range" onSubmit={apply}>
          <label>
            De
            <input type="date" value={de} onChange={(e) => { setDe(e.target.value); setError(""); }} />
          </label>
          <label>
            Até
            <input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setError(""); }} />
          </label>
          <button className="btn btn-primary" type="submit">Aplicar</button>
          {error ? <span className="neg small">{error}</span> : null}
        </form>
      ) : null}
    </div>
  );
}
