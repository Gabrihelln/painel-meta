// Status de entrega do anúncio no Meta (effective_status) traduzido para o painel.

export type AdStatusKey = "ativo" | "pausado" | "analise" | "reprovado" | "problema" | "arquivado" | "desconhecido";

const MAP: Record<string, AdStatusKey> = {
  ACTIVE: "ativo",
  PAUSED: "pausado",
  CAMPAIGN_PAUSED: "pausado",
  ADSET_PAUSED: "pausado",
  PENDING_REVIEW: "analise",
  IN_PROCESS: "analise",
  PREAPPROVED: "analise",
  PENDING_BILLING_INFO: "problema",
  DISAPPROVED: "reprovado",
  WITH_ISSUES: "problema",
  ARCHIVED: "arquivado",
  DELETED: "arquivado",
};

export function adStatusKey(raw: string | null | undefined): AdStatusKey {
  return (raw && MAP[raw.toUpperCase()]) || "desconhecido";
}

export const AD_STATUS_LABEL: Record<AdStatusKey, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  analise: "Em análise",
  reprovado: "Reprovado",
  problema: "Com problema",
  arquivado: "Arquivado",
  desconhecido: "—",
};

/** Detalhe mostrado ao passar o mouse (ex.: pausado pela campanha). */
export function adStatusDetail(raw: string | null | undefined): string {
  switch ((raw ?? "").toUpperCase()) {
    case "CAMPAIGN_PAUSED": return "Pausado porque a campanha está pausada";
    case "ADSET_PAUSED": return "Pausado porque o conjunto está pausado";
    case "PAUSED": return "Anúncio pausado";
    case "ACTIVE": return "Veiculando";
    case "PENDING_BILLING_INFO": return "Pendência de pagamento na conta de anúncios";
    case "": return "Status ainda não sincronizado ou anúncio arquivado/excluído no Meta";
    default: return raw ?? "";
  }
}

/** Ordem para ordenar a coluna (ativos primeiro). */
export const AD_STATUS_ORDER: Record<AdStatusKey, number> = {
  ativo: 6, analise: 5, problema: 4, reprovado: 3, pausado: 2, arquivado: 1, desconhecido: 0,
};
