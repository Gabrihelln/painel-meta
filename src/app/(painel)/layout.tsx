import { Suspense } from "react";
import Nav from "@/components/Nav";
import { requireSession } from "@/lib/session";
import { passwordRequired } from "@/lib/auth";
import { isDemo } from "@/lib/data";
import { logout } from "../login/actions";

export default async function PainelLayout({ children }: LayoutProps<"/">) {
  await requireSession();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-dot" /> Painel de vendas</div>
        <Suspense fallback={null}><Nav /></Suspense>
        <div className="spacer" />
        {passwordRequired() ? (
          <form action={logout}><button className="btn" type="submit">Sair</button></form>
        ) : null}
      </header>
      {isDemo() ? (
        <div className="demo-banner">
          Modo demonstração: os números são de exemplo. Configure o Supabase (veja o README) para ver seus dados reais.
        </div>
      ) : null}
      {children}
    </div>
  );
}
