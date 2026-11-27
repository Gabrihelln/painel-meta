# Painel de vendas (Wiapy + Meta Ads)

Painel próprio que junta as **vendas reais da Wiapy** com o **gasto e as métricas do Meta Ads**, por campanha, conjunto e criativo.

- **Resumo**: lucro do período, faturamento, gasto, ROAS, vendas, Pix/boleto pendente e lucro por dia.
- **Anúncios**: tabela por campanha → conjunto → anúncio, com situação (Escalar / Bom / Atenção / Pausar).
- **Criativos**: uma linha por criativo, com gasto, vendas, ROAS, lucro, CPA, CTR, CPM, retenção de 3s e o funil completo.
- **Vendas**: lista de vendas com status e de qual anúncio cada uma veio.
- **Configurações**: status das conexões, imposto, custos e regras da coluna Situação.

Sem banco configurado, o painel abre em **modo demonstração** com números de exemplo.

## Como funciona

```
Anúncio Meta (UTM com o id do anúncio)
  → Página de vendas (script utm.js repassa as UTMs)
  → Checkout Wiapy
  → Webhook → /api/webhooks/wiapy → Supabase (tabela sales)

GitHub Actions (a cada 15 min) → /api/cron/meta-sync → API do Meta → Supabase (ad_insights, ads)

Painel (Vercel) lê o Supabase e cruza venda × anúncio pelo id do anúncio.
```

---

## Instalação (uma vez, ~30 minutos)

### 1. Supabase (banco de dados, grátis)

1. Crie uma conta em https://supabase.com e um projeto novo (região São Paulo).
2. Vá em **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
3. Copie o endereço do projeto: **Integrations → Data API → Project URL** (ou o botão **Connect** no topo do projeto). Ele tem o formato `https://xxxx.supabase.co` → `SUPABASE_URL`.
4. Copie a chave secreta: **Project Settings → API Keys**, seção **Secret keys**. Se não houver nenhuma, clique em **Create new API keys** / **Add new secret key**. Ela começa com `sb_secret_...` → `SUPABASE_SERVICE_ROLE_KEY`.
   - Projetos antigos também mostram a aba **Legacy API keys** com a chave `service_role`, que funciona igual. Prefira a `sb_secret_`, porque o Supabase vai desativar as chaves antigas.
   - Nunca coloque essa chave no código nem compartilhe: ela dá acesso total ao banco.
   - Não use a chave **publishable** (`sb_publishable_...`). O painel precisa da secreta.

### 2. Token do Meta Ads

Primeiro, pegue o **id da conta de anúncios**: no Gerenciador de Anúncios, ele aparece na URL (`act=123456...`). Use em `META_AD_ACCOUNT_IDS` como `act_123456...` (várias contas separadas por vírgula).

Os dois caminhos abaixo começam criando um app.

**Passo comum: criar o app**

1. Acesse https://developers.facebook.com → **Meus apps → Criar app**.
2. Escolha o caso de uso de **anúncios / Marketing API** (ou "Outro" → tipo **Empresa**) e, se pedir, selecione o seu **portfólio empresarial**.
3. Dentro do app, adicione o produto **Marketing API**, se ele não vier adicionado.

**Caminho A: rápido, token de 60 dias (bom para começar e testar)**

1. Abra o **Graph API Explorer**: https://developers.facebook.com/tools/explorer
2. À direita, em **Meta App**, escolha o app que você criou.
3. Em **Permissões**, adicione `ads_read` e clique em **Generate Access Token**. Faça login e autorize as suas contas de anúncio.
4. Esse token dura só ~1 hora. Para estender, abra https://developers.facebook.com/tools/debug/accesstoken, cole o token, clique em **Depurar** e depois em **Estender token de acesso** (no rodapé).
5. O token novo dura ~60 dias e é o `META_ACCESS_TOKEN`. Quando ele vencer, a tela **Configurações** do painel mostra o erro e você repete os passos 3 e 4.

**Caminho B: definitivo, token que não expira (usuário do sistema)**

A opção "Usuários do sistema" só aparece **depois** que o app está ligado ao seu portfólio empresarial, e você precisa ser **administrador** do portfólio.

1. Acesse https://business.facebook.com/settings (ou, no Meta Business Suite, a **engrenagem de Configurações**, embaixo à esquerda).
2. Em **Contas → Apps**, confira se o app aparece. Se não aparecer, clique em **Adicionar → Conectar um ID do app** e cole o id do app, que fica no topo do painel do app.
3. Em **Usuários → Usuários do sistema**, clique em **Adicionar**, dê um nome (ex.: "painel") e escolha a função **Admin**.
4. Selecione o usuário criado → **Atribuir ativos** → **Contas de anúncios** → marque suas contas → permissão para **ver desempenho** → **Salvar**.
5. Dê ao usuário do sistema uma função no app. Sem isso, a tela de token mostra "Nenhuma permissão disponível". Escolha um destes caminhos:
   - Em **Usuários do sistema**, selecione o usuário → **Atribuir ativos** → **Apps** → marque o app → ative **Gerenciar app** (controle total) → **Salvar**; ou
   - Em **Contas → Apps**, selecione o app → **Atribuir pessoas** → escolha o usuário do sistema → **Gerenciar app** → **Salvar**.
6. Ainda no usuário do sistema, clique em **Gerar novo token** → escolha o app → validade **Nunca** → marque `ads_read` → **Gerar**. Copie na hora, porque ele só aparece uma vez. Esse é o `META_ACCESS_TOKEN`.

Se mesmo assim não aparecer "Usuários do sistema", sua conta de anúncios provavelmente não está dentro de um portfólio empresarial, ou você não é administrador dele. Use o caminho A.

### 3. GitHub + Vercel

1. Crie um repositório **privado** no GitHub e envie este projeto:
   ```
   git remote add origin https://github.com/SEU-USUARIO/painel-vendas.git
   git push -u origin main
   ```
2. Em https://vercel.com → **Add New → Project** → importe o repositório.
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre (veja [`.env.example`](.env.example)):

   | Variável | O que é |
   |---|---|
   | `PAINEL_SENHA` | senha para entrar no painel |
   | `AUTH_SECRET` | texto aleatório longo |
   | `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | do passo 1 |
   | `WIAPY_WEBHOOK_TOKEN` | texto aleatório que você também vai colar na Wiapy |
   | `META_ACCESS_TOKEN` / `META_AD_ACCOUNT_IDS` | do passo 2 |
   | `CRON_SECRET` | texto aleatório (protege a sincronização) |

4. Deploy. O painel fica em `https://SEU-PROJETO.vercel.app`.

### 4. Sincronização automática do Meta (a cada 15 minutos)

O plano grátis da Vercel só roda tarefas agendadas 1 vez por dia (já configurado em `vercel.json`). Para atualizar a cada 15 minutos, o GitHub faz a chamada:

1. No GitHub: **Settings → Secrets and variables → Actions → New repository secret**:
   - `PAINEL_URL` = `https://SEU-PROJETO.vercel.app`
   - `CRON_SECRET` = o mesmo valor cadastrado na Vercel
2. Aba **Actions** → **Sincronizar Meta Ads** → **Run workflow** para testar.

Na primeira vez, abra **Configurações** no painel e clique em **Atualizar Meta agora** com "Últimos 30 dias" para trazer o histórico.

### 5. Webhook na Wiapy

No checkout da Wiapy → **Integrações → Webhook**:

- **URL**: `https://SEU-PROJETO.vercel.app/api/webhooks/wiapy`
- **Token**: o mesmo valor de `WIAPY_WEBHOOK_TOKEN`

Repita em cada checkout que você usa. A tela **Configurações** mostra quando a primeira venda chegar.

### 6. UTMs nos anúncios

Em cada anúncio do Meta → **Rastreamento → Parâmetros de URL**, cole:

```
utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.id}}
```

O `{{ad.id}}` é o que liga cada venda ao criativo certo.

### 7. Script na página de vendas

Se o botão de compra da sua página de vendas leva para o checkout Wiapy, cole antes de `</body>` (ou num bloco de "HTML personalizado"):

```html
<script src="https://SEU-PROJETO.vercel.app/utm.js" defer></script>
```

Ele guarda as UTMs do anúncio e as acrescenta aos links do checkout. Se o seu checkout usa domínio próprio, informe-o:

```html
<script src="https://SEU-PROJETO.vercel.app/utm.js" data-dominios="wiapy,pay.seudominio.com" defer></script>
```

### 8. Teste de ponta a ponta

1. Abra sua página de vendas com `?utm_source=meta&utm_content=123456789012` no final da URL.
2. Clique no botão de compra e confira se o link do checkout ficou com as UTMs.
3. Gere um Pix de teste. A venda deve aparecer em **Vendas** como "Aguardando".
4. Se aparecer como "Sem rastreio", a Wiapy não está repassando as UTMs do link. Nesse caso, me chame para ajustarmos.

---

## Importar vendas antigas (planilha da Wiapy)

O webhook só traz vendas novas. Para trazer o histórico, exporte as vendas da Wiapy em Excel e rode, na pasta do projeto:

```
python scripts/xlsx_para_json.py "C:\caminho\da\planilha.xlsx" > importar\vendas.json
node --env-file=.env scripts/importar-wiapy.mjs importar\vendas.json
node --env-file=.env scripts/importar-wiapy.mjs importar\vendas.json --gravar
```

- O segundo comando só **simula** e mostra quantas vendas pagas vão entrar. O terceiro grava.
- Só vendas **pagas** são importadas. Vendas que já estão no banco não são alteradas, então dá para rodar de novo sem duplicar.
- A planilha não tem UTM, então essas vendas aparecem como "Sem rastreio".
- A pasta `importar/` fica fora do Git (tem dados de clientes). Apague a planilha e o JSON depois de importar.

## Rodar no seu PC

```
npm install
npm run dev
```

Abra http://localhost:3000. Sem `.env.local`, abre em modo demonstração.

- `npm test`: testes dos cálculos e da leitura do webhook
- `npm run build`: confere se está tudo certo para publicar

## Como os números são calculados

- **Faturamento**: soma das vendas **pagas** (inclui order bump). Reembolsos e chargebacks saem automaticamente.
- **Lucro** = faturamento − taxa da Wiapy − imposto (%) − custo fixo por venda − gasto no Meta.
- **ROAS** = faturamento ÷ gasto. **ROI** = lucro ÷ gasto.
- **CPA** = gasto ÷ vendas pagas.
- **Retenção 3s** = visualizações de 3 segundos ÷ impressões (só vídeo). **ThruPlay** = visualizações de 15s+ ÷ impressões.
- Datas no fuso de São Paulo. Use a conta de anúncios no fuso de São Paulo para os dias baterem.
- As vendas usam a **venda real** da Wiapy, não a compra que o pixel informa. Por isso os números diferem do Gerenciador de Anúncios.
