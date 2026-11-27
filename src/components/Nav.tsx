"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Resumo" },
  { href: "/anuncios", label: "Anúncios" },
  { href: "/criativos", label: "Criativos" },
  { href: "/paginas", label: "Páginas" },
  { href: "/vendas", label: "Vendas" },
  { href: "/configuracoes", label: "Configurações" },
];

export default function Nav() {
  const path = usePathname();
  const params = useSearchParams();
  // mantém o período escolhido ao trocar de aba
  const keep = new URLSearchParams();
  for (const k of ["periodo", "de", "ate"]) {
    const v = params.get(k);
    if (v) keep.set(k, v);
  }
  const qs = keep.toString();
  return (
    <nav className="nav">
      {ITEMS.map((it) => {
        const on = it.href === "/" ? path === "/" : path.startsWith(it.href);
        const href = qs && it.href !== "/configuracoes" ? `${it.href}?${qs}` : it.href;
        return (
          <Link key={it.href} href={href} className={on ? "on" : ""}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
