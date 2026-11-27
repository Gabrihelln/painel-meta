"use client";

import { useActionState } from "react";
import { refreshMetaAction, type RefreshState } from "@/app/(painel)/actions";

const initial: RefreshState = { ok: null, message: "" };

/** Ícone circular que busca os dados mais recentes do Meta e recarrega a tela. */
export default function RefreshButton({ lastSync }: { lastSync: string }) {
  const [state, action, pending] = useActionState(async () => refreshMetaAction(), initial);
  const status = pending ? "Atualizando…" : state.ok === false ? state.message : lastSync;
  return (
    <form action={action} className="refresh">
      <span className={`faint ${state.ok === false && !pending ? "neg" : ""}`} title={status}>{status}</span>
      <button
        type="submit"
        className="icon-btn"
        disabled={pending}
        aria-label="Atualizar dados do Meta agora"
        title="Atualizar dados do Meta agora"
      >
        <svg className={pending ? "spin" : ""} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    </form>
  );
}
