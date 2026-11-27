import { headers } from "next/headers";
import { isDemo, loadSales, loadSettings } from "@/lib/data";
import { dateTimeBR, pct } from "@/lib/format";
import { metaConfigFromEnv } from "@/lib/meta";
import { addDays, localDate } from "@/lib/period";
import { requireSession } from "@/lib/session";
import { saveSettingsAction, syncNowAction } from "./actions";

function Status({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return <p className={`small ${ok ? (warn ? "warn" : "pos") : "neg"}`} style={{ marginTop: 4 }}>{children}</p>;
}

export default async function ConfigPage({ searchParams }: PageProps<"/configuracoes">) {
  await requireSession();
  const sp = await searchParams;
  const settings = await loadSettings();
  const today = localDate(new Date());
  const sales = await loadSales(addDays(today, -6), today);
  const paid = sales.filter((s) => s.status === "paid");
  const coverage = paid.length ? (paid.filter((s) => s.ad_id).length / paid.length) * 100 : null;
  const lastSale = sales[0];

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "seu-projeto.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const meta = metaConfigFromEnv();
  const demo = isDemo();
  const webhookTokenSet = Boolean(process.env.WIAPY_WEBHOOK_TOKEN);

  return (
    <div className="stack">
      {sp.salvo ? <p className="ok-msg">Configurações salvas.</p> : null}
      {sp.sync === "ok" ? <p className="ok-msg">Meta sincronizado: {sp.n} linhas de anúncio por dia atualizadas.</p> : null}
      {sp.sync === "erro" ? <p className="err-msg">Não deu para sincronizar o Meta: {settings.last_meta_sync_error ?? "erro desconhecido"}</p> : null}
      {sp.sync === "demo" ? <p className="err-msg">No modo demonstração não há Meta conectado. Configure o Supabase e o token do Meta.</p> : null}

      <div className="card">
        <h2>Conexões</h2>
        <div className="grid-2">
          <div>
            <p className="muted small">Webhook Wiapy</p>
            {demo ? <Status ok={false}>Banco não configurado (modo demonstração)</Status>
              : !webhookTokenSet ? <Status ok={false}>Falta a variável WIAPY_WEBHOOK_TOKEN</Status>
              : lastSale ? <Status ok>Recebendo · última venda {dateTimeBR(lastSale.received_at ?? lastSale.created_at)}</Status>
              : <Status ok warn>Pronto, aguardando a primeira venda</Status>}
          </div>
          <div>
            <p className="muted small">Meta Ads</p>
            {!meta ? <Status ok={false}>Falta META_ACCESS_TOKEN ou META_AD_ACCOUNT_IDS</Status>
              : settings.last_meta_sync_error ? <Status ok={false}>Erro: {settings.last_meta_sync_error}</Status>
              : settings.last_meta_sync_at ? <Status ok>{meta.accounts.length} conta(s) · atualizado {dateTimeBR(settings.last_meta_sync_at)}</Status>
              : <Status ok warn>{meta.accounts.length} conta(s) · ainda não sincronizado</Status>}
          </div>
          <div>
            <p className="muted small">Vendas com UTM de anúncio (7 dias)</p>
            {coverage === null ? <Status ok warn>Sem vendas pagas ainda</Status>
              : <Status ok={coverage >= 50} warn={coverage < 85}>{pct(coverage, 0)} das vendas pagas</Status>}
          </div>
        </div>
        <form action={syncNowAction} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <select name="dias" defaultValue="7">
            <option value="3">Últimos 3 dias</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
          <button className="btn" type="submit">Atualizar Meta agora</button>
          <span className="faint">Automático a cada 15 minutos (GitHub Actions) e uma vez por dia (Vercel).</span>
        </form>
      </div>

      <form action={saveSettingsAction} className="card">
        <h2>Custos para calcular o lucro</h2>
        <p className="faint" style={{ marginBottom: 12 }}>A taxa da Wiapy já vem em cada venda. Aqui você coloca o que ela não sabe.</p>
        <div className="grid-2">
          <label className="field">Imposto sobre o faturamento (%)
            <input type="number" step="0.01" min="0" max="100" name="tax_percent" defaultValue={settings.tax_percent} />
          </label>
          <label className="field">Custo fixo por venda (R$)
            <input type="number" step="0.01" min="0" name="fixed_cost" defaultValue={settings.fixed_cost_per_sale_cents / 100} />
          </label>
        </div>
        <h2 style={{ marginTop: 18 }}>Regras da coluna Situação</h2>
        <div className="grid-2">
          <label className="field">Pausar: ROI abaixo de (%)
            <input type="number" step="1" name="roi_pause" defaultValue={settings.roi_pause} />
          </label>
          <label className="field">Atenção: ROI abaixo de (%)
            <input type="number" step="1" name="roi_attention" defaultValue={settings.roi_attention} />
          </label>
          <label className="field">Escalar: ROI a partir de (%)
            <input type="number" step="1" name="roi_scale" defaultValue={settings.roi_scale} />
          </label>
          <label className="field">Só julgar depois de gastar (R$)
            <input type="number" step="1" min="0" name="min_spend_to_judge" defaultValue={settings.min_spend_to_judge} />
          </label>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn btn-primary" type="submit">Salvar</button>
        </div>
      </form>

      <div className="card">
        <h2>Para colar nas plataformas</h2>
        <div className="stack">
          <div>
            <p className="muted small">URL do webhook (cole na Wiapy, em Integrações &gt; Webhook do checkout)</p>
            <code className="code">{origin}/api/webhooks/wiapy</code>
            <p className="faint" style={{ marginTop: 4 }}>No campo de token da Wiapy, use o mesmo valor da variável WIAPY_WEBHOOK_TOKEN.</p>
          </div>
          <div>
            <p className="muted small">Parâmetros de URL dos anúncios (Meta &gt; anúncio &gt; Rastreamento &gt; Parâmetros de URL)</p>
            <code className="code">utm_source=meta&amp;utm_medium=paid&amp;utm_campaign={"{{campaign.name}}"}&amp;utm_term={"{{adset.name}}"}&amp;utm_content={"{{ad.id}}"}</code>
          </div>
          <div>
            <p className="muted small">Script da página de vendas (cole antes de &lt;/body&gt;) — repassa as UTMs para o link do checkout</p>
            <code className="code">{`<script src="${origin}/utm.js" defer></script>`}</code>
          </div>
        </div>
      </div>
    </div>
  );
}
