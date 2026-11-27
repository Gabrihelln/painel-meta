"use server";

import { refresh } from "next/cache";
import { isDemo } from "@/lib/data";
import { requireSession } from "@/lib/session";
import { syncMeta } from "@/lib/sync";

export interface RefreshState {
  ok: boolean | null;
  message: string;
}

/** Botão de atualizar do Resumo: busca os últimos 3 dias no Meta e recarrega a tela. */
export async function refreshMetaAction(): Promise<RefreshState> {
  await requireSession();
  if (isDemo()) {
    refresh();
    return { ok: true, message: "Modo demonstração: nada para buscar no Meta" };
  }
  const r = await syncMeta(3);
  refresh();
  return r.ok
    ? { ok: true, message: "Meta atualizado" }
    : { ok: false, message: r.error ?? "Não deu para atualizar o Meta" };
}
