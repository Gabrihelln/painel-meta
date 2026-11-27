import { headers } from "next/headers";
import { isDemo, loadSales, loadSettings } from "@/lib/data";
import { dateTimeBR, money, pct } from "@/lib/format";
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

  // exemplo da legenda: 1 venda de R$ 100 (taxa Wiapy R$ 6) com R$ 40 de anúncio
  const ex = { venda: 100, taxa: 6, anuncio: 40 };
  const exImposto = (ex.venda * settings.tax_percent) / 100;
  const exAdTax = (ex.anuncio * settings.ad_tax_percent) / 100;
  const exFixo = settings.fixed_cost_per_sale_cents / 100;
  const exLucro = ex.venda - ex.taxa - exImposto - exFixo - ex.anuncio - exAdTax;
  const exRoi = (exLucro / (ex.anuncio + exAdTax)) * 100;
  const example =
    `venda de ${money(ex.venda)} − taxa Wiapy ${money(ex.taxa)} − imposto ${money(exImposto)} − custo fixo ${money(exFixo)}` +
    ` − anúncio ${money(ex.anuncio)} − imposto/IOF do anúncio ${money(exAdTax)} = lucro ${money(exLucro)} (ROI ${pct(exRoi, 0)}).`;

  const meta = metaConfigFromEnv();
  const demo = isDemo();
  const webhookTokenSet = Boolean(process.env.WIAPY_WEBHOOK_TOKEN);

  return (
    <div className="stack">
      {sp.salvo ? <p className="ok-msg">Configurações salvas.</p> : null}
      {sp.erro === "migracao" ? (
        <div className="err-msg">
          Falta atualizar o banco para o campo novo. No Supabase, abra <b>SQL Editor → New query</b>, cole a linha abaixo e
          clique em <b>Run</b>. Depois salve de novo.
          <code className="code" style={{ marginTop: 6 }}>alter table settings add column if not exists ad_tax_percent numeric(5,2) not null default 0;</code>
        </div>
      ) : null}
      {sp.erro === "salvar" ? <p className="err-msg">Não deu para salvar as configurações. Tente de novo.</p> : null}
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
        <div className="help-box">
          <p><strong>Como o painel calcula o lucro</strong></p>
          <p className="formula">
            Lucro = faturamento − taxa da Wiapy − imposto sobre o faturamento − custo fixo × vendas − gasto no Meta − imposto/IOF sobre o gasto
          </p>
          <ul>
            <li><strong>Faturamento</strong>: soma das vendas <em>pagas</em> na Wiapy (com order bump). Pendentes, recusadas e reembolsos não entram.</li>
            <li><strong>Taxa da Wiapy</strong>: vem sozinha em cada venda (campo &quot;Taxa&quot; da Wiapy). Não precisa cadastrar.</li>
            <li><strong>Gasto no Meta</strong>: vem sozinho do Gerenciador de Anúncios (valor sem impostos).</li>
            <li>Os campos abaixo cobrem o que nenhuma das duas plataformas informa.</li>
          </ul>
          <p className="faint">Exemplo com os valores salvos hoje: {example}</p>
        </div>
        <div className="grid-2">
          <label className="field">Imposto sobre o faturamento (%)
            <input type="number" step="0.01" min="0" max="100" name="tax_percent" defaultValue={settings.tax_percent} />
            <span className="hint">
              O imposto que você paga sobre o que vende. <b>Simples Nacional</b>: use a alíquota efetiva da sua guia do Simples
              (infoproduto costuma começar em 6%). <b>MEI</b>: o DAS é fixo por mês, deixe 0. Na dúvida, pergunte ao contador
              &quot;qual minha alíquota efetiva sobre o faturamento&quot;.
            </span>
          </label>
          <label className="field">Imposto/IOF sobre o gasto em anúncios (%)
            <input type="number" step="0.01" min="0" max="100" name="ad_tax_percent" defaultValue={settings.ad_tax_percent} />
            <span className="hint">
              O Meta mostra o gasto <b>sem impostos</b>, mas a cobrança no cartão pode vir maior (impostos na fatura do Meta e/ou IOF
              do cartão). Para descobrir: em Meta &gt; <b>Faturamento e pagamentos</b>, compare o valor cobrado com o valor dos
              anúncios no mesmo período. Ex.: gastou R$ 1.000 e foram cobrados R$ 1.121 → coloque 12,1. Se for igual, deixe 0.
            </span>
          </label>
          <label className="field">Custo fixo por venda (R$)
            <input type="number" step="0.01" min="0" name="fixed_cost" defaultValue={settings.fixed_cost_per_sale_cents / 100} />
            <span className="hint">
              Quanto custa entregar <b>cada venda</b> e que a Wiapy não desconta: comissão de coprodutor/afiliado paga por fora,
              área de membros que cobra por aluno, impressão/frete de produto físico. Produto 100% digital entregue pela Wiapy: 0.
            </span>
          </label>
        </div>

        <h2 style={{ marginTop: 22 }}>Regras da coluna Situação</h2>
        <div className="help-box">
          <p>
            Cada campanha, conjunto e criativo recebe uma etiqueta pelo <strong>ROI</strong> = lucro ÷ custo dos anúncios.
            Como o lucro já desconta tudo acima, <strong>ROI 0% é o ponto de equilíbrio</strong>: acima disso o anúncio se paga
            e sobra dinheiro; abaixo, dá prejuízo. ROI 100% = cada R$ 1 investido volta R$ 1 de lucro.
          </p>
          <p className="faint">
            Etiquetas com os valores salvos: <span className="pill red">Pausar</span> abaixo de {settings.roi_pause}% ·{" "}
            <span className="pill amber">Atenção</span> de {settings.roi_pause}% a {settings.roi_attention}% ·{" "}
            <span className="pill green">Bom</span> de {settings.roi_attention}% a {settings.roi_scale}% ·{" "}
            <span className="pill green">Escalar</span> a partir de {settings.roi_scale}% ·{" "}
            <span className="pill gray">Aprendendo</span> enquanto gastou menos que {money(settings.min_spend_to_judge)} e ainda não deu lucro.
          </p>
        </div>
        <div className="grid-2">
          <label className="field">Pausar: ROI abaixo de (%)
            <input type="number" step="1" name="roi_pause" defaultValue={settings.roi_pause} />
            <span className="hint">Abaixo disso o anúncio dá prejuízo. Recomendado: <b>0</b> (ponto de equilíbrio).</span>
          </label>
          <label className="field">Atenção: ROI abaixo de (%)
            <input type="number" step="1" name="roi_attention" defaultValue={settings.roi_attention} />
            <span className="hint">Dá lucro, mas pouco: vale testar outro criativo ou público. Sugestão: <b>30</b>.</span>
          </label>
          <label className="field">Escalar: ROI a partir de (%)
            <input type="number" step="1" name="roi_scale" defaultValue={settings.roi_scale} />
            <span className="hint">Lucro alto e consistente: candidato a aumentar o orçamento. Sugestão: <b>100</b>.</span>
          </label>
          <label className="field">Só julgar depois de gastar (R$)
            <input type="number" step="1" min="0" name="min_spend_to_judge" defaultValue={settings.min_spend_to_judge} />
            <span className="hint">
              Evita marcar &quot;Pausar&quot; num anúncio que mal começou: até gastar esse valor sem dar lucro, ele fica como
              &quot;Aprendendo&quot;. Regra prática: <b>2 a 3 vezes o preço do produto</b> (ex.: produto de R$ 39,90 → R$ 80 a R$ 120).
            </span>
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
