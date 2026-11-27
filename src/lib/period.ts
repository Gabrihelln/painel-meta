// Datas do painel no fuso de São Paulo (UTC-3, sem horário de verão desde 2019).
const OFFSET_HOURS = -3;

export type PeriodKey = "hoje" | "ontem" | "7d" | "30d" | "mes";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
];

export interface Range {
  key: PeriodKey;
  label: string;
  since: string; // YYYY-MM-DD (inclusive)
  until: string; // YYYY-MM-DD (inclusive)
}

/** Data local (YYYY-MM-DD) de um instante. */
export function localDate(d: Date | string): string {
  const t = typeof d === "string" ? new Date(d) : d;
  return new Date(t.getTime() + OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
}

export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(since: string, until: string): number {
  return Math.round((Date.parse(until) - Date.parse(since)) / 86400_000) + 1;
}

export function listDays(since: string, until: string): string[] {
  const out: string[] = [];
  for (let d = since; d <= until; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Início do dia local em UTC ISO. */
export function startOfLocalDayUtc(date: string): string {
  return new Date(Date.parse(date + "T00:00:00Z") - OFFSET_HOURS * 3600_000).toISOString();
}

export function parsePeriod(value: string | string[] | undefined, now = new Date()): Range {
  const key = (Array.isArray(value) ? value[0] : value) as PeriodKey;
  const today = localDate(now);
  const label = PERIODS.find((p) => p.key === key)?.label;
  switch (label ? key : "hoje") {
    case "ontem":
      return { key: "ontem", label: "Ontem", since: addDays(today, -1), until: addDays(today, -1) };
    case "7d":
      return { key: "7d", label: "7 dias", since: addDays(today, -6), until: today };
    case "30d":
      return { key: "30d", label: "30 dias", since: addDays(today, -29), until: today };
    case "mes":
      return { key: "mes", label: "Este mês", since: today.slice(0, 8) + "01", until: today };
    default:
      return { key: "hoje", label: "Hoje", since: today, until: today };
  }
}

/** Período anterior com o mesmo número de dias (para comparação). */
export function previousRange(r: Range): { since: string; until: string } {
  const n = daysBetween(r.since, r.until);
  return { since: addDays(r.since, -n), until: addDays(r.since, -1) };
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export function shortDayLabel(date: string, today: string): string {
  if (date === today) return "hoje";
  const d = new Date(date + "T12:00:00Z");
  return `${WEEKDAYS[d.getUTCDay()]} ${date.slice(8, 10)}`;
}

/** Mesmo horário de ontem (ms), para comparar "hoje" com ontem até agora. */
export function sameTimeYesterdayMs(): number {
  return Date.now() - 86400_000;
}
