"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Resumo" },
  { href: "/anuncios", label: "Anúncios" },
  { href: "/criativos", label: "Criativos" },
  { href: "/vendas", label: "Vendas" },
  { href: "/configuracoes", label: "Configurações" },
];

export default function Nav() {
  const path = usePathname();
  const params = useSearchParams();
  const periodo = params.get("periodo");
  return (
    <nav className="nav">
      {ITEMS.map((it) => {
        const on = it.href === "/" ? path === "/" : path.startsWith(it.href);
        const href = periodo && it.href !== "/configuracoes" ? `${it.href}?periodo=${periodo}` : it.href;
        return (
          <Link key={it.href} href={href} className={on ? "on" : ""}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
