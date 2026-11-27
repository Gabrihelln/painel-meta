import Link from "next/link";

/** Alterna entre mostrar só os criativos ativos no Meta ou todos. Usa o parâmetro ?mostrar=ativos. */
export default function StatusFilter({
  href,
  current,
  activeCount,
  totalCount,
}: {
  /** URL atual sem o parâmetro "mostrar" (deve já ter "?"). */
  href: string;
  current: "ativos" | "todos";
  activeCount: number;
  totalCount: number;
}) {
  return (
    <div className="tabs small-tabs">
      <Link href={`${href}&mostrar=todos`} className={current === "todos" ? "on" : ""}>Todos ({totalCount})</Link>
      <Link href={`${href}&mostrar=ativos`} className={current === "ativos" ? "on" : ""}>● Ativos ({activeCount})</Link>
    </div>
  );
}

export function parseMostrar(v: string | string[] | undefined): "ativos" | "todos" {
  return (Array.isArray(v) ? v[0] : v) === "ativos" ? "ativos" : "todos";
}
