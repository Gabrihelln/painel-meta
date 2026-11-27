// Datas do painel no fuso de São Paulo (UTC-3, sem horário de verão desde 2019).
const OFFSET_HOURS = -3;

export type PeriodKey = "hoje" | "ontem" | "7d" | "30d" | "mes" | "todos" | "personalizado";

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "7d", label: "7 dias" },
  { key: "30d", label: "30 dias" },
  { key: "mes", label: "Este mês" },
  { key: "todos", label: "Todos" },
];

/** Data inicial usada para "Todos" (antes de qualquer venda possível). */
export const ALL_SINCE = "2000-01-01";

export interface Range {
  key: PeriodKey;
  label: string;
  since: string; // YYYY-MM-DD (inclusive)
  until: string; // YYYY-MM-DD (inclusive)
  /** Parâmetros de URL que reproduzem este período (ex.: "periodo=7d"). */
  query: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const isDate = (v: string | undefined): v is string =>
  Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z")));

/** "2026-11-05" → "05/11/2026" */
export function formatDateBR(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}`;
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

/** Lê o período da URL: ?periodo=7d, ?periodo=todos ou ?periodo=personalizado&de=AAAA-MM-DD&ate=AAAA-MM-DD */
export function parsePeriod(sp: SearchParams, now = new Date()): Range {
  const key = one(sp.periodo) as PeriodKey;
  const today = localDate(now);
  const q = (k: string) => `periodo=${k}`;
  switch (key) {
    case "ontem":
      return { key, label: "Ontem", since: addDays(today, -1), until: addDays(today, -1), query: q(key) };
    case "7d":
      return { key, label: "7 dias", since: addDays(today, -6), until: today, query: q(key) };
    case "30d":
      return { key, label: "30 dias", since: addDays(today, -29), until: today, query: q(key) };
    case "mes":
      return { key, label: "Este mês", since: today.slice(0, 8) + "01", until: today, query: q(key) };
    case "todos":
      return { key, label: "Todos", since: ALL_SINCE, until: today, query: q(key) };
    case "personalizado": {
      let de = one(sp.de);
      let ate = one(sp.ate);
      if (!isDate(de) && !isDate(ate)) break;
      if (!isDate(de)) de = ate!;
      if (!isDate(ate)) ate = de;
      if (de > ate) [de, ate] = [ate, de];
      const label = de === ate ? formatDateBR(de) : `${formatDateBR(de)} a ${formatDateBR(ate)}`;
      return { key, label, since: de, until: ate, query: `periodo=personalizado&de=${de}&ate=${ate}` };
    }
  }
  return { key: "hoje", label: "Hoje", since: today, until: today, query: q("hoje") };
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
