import Link from "next/link";
import { PERIODS, type PeriodKey } from "@/lib/period";

export default function PeriodTabs({
  current,
  base,
  keep = {},
}: {
  current: PeriodKey;
  base: string;
  keep?: Record<string, string | undefined>;
}) {
  return (
    <div className="tabs">
      {PERIODS.map((p) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
        q.set("periodo", p.key);
        return (
          <Link key={p.key} href={`${base}?${q}`} className={p.key === current ? "on" : ""}>
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
