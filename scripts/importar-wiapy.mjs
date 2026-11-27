// Importa vendas PAGAS de uma planilha exportada da Wiapy para a tabela `sales` do Supabase.
//
// Uso (PowerShell, na pasta do projeto):
//   python scripts/xlsx_para_json.py "C:\caminho\vendas.xlsx" > importar\vendas.json
//   node --env-file=.env scripts/importar-wiapy.mjs importar\vendas.json            (simula, não grava)
//   node --env-file=.env scripts/importar-wiapy.mjs importar\vendas.json --gravar   (grava)
//
// Vendas que já existem no banco (por exemplo, recebidas pelo webhook) não são alteradas.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [file, flag] = process.argv.slice(2);
const write = flag === "--gravar";
if (!file) {
  console.error("Informe o arquivo JSON gerado pelo xlsx_para_json.py");
  process.exit(1);
}

const rows = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const header = rows[0].map((h) => String(h ?? "").trim().toLowerCase());
const col = (name) => {
  const i = header.indexOf(name.toLowerCase());
  if (i < 0) throw new Error(`Coluna "${name}" não encontrada. Colunas: ${rows[0].join(" | ")}`);
  return i;
};
const C = {
  id: col("ID"), produto: col("Produto"), produtos: col("Produtos"), bumps: col("Orderbumps"),
  status: col("Status"), valor: col("Valor Pago"), metodo: col("Método"), nome: col("Nome cliente"),
  email: col("E-Mail cliente"), data: col("Data"), taxa: col("Taxa"),
};

const cents = (v) => Math.round(Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")) * 100) || 0;
const STATUS = {
  "pago": "paid", "aguardando pagamento": "unpaid", "recusado": "credit_card_declined",
  "reembolsado": "refunded", "estornado": "refunded", "chargeback": "chargedback",
};
const METHOD = { "pix": "pix", "cartão de crédito": "credit_card", "boleto": "boleto" };

/** "27/11/2026 12:21:12" (horário de Brasília) → ISO UTC */
function toIso(v) {
  const m = String(v ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) throw new Error(`Data inválida: ${v}`);
  const [, d, mo, y, h, mi, s = "00"] = m;
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}-03:00`).toISOString();
}

const all = rows.slice(1).filter((r) => r[C.id]);
const sales = all
  .filter((r) => STATUS[String(r[C.status] ?? "").trim().toLowerCase()] === "paid")
  .map((r) => {
    const created = toIso(r[C.data]);
    const bumps = String(r[C.bumps] ?? "").match(/R\$\s*[\d.,]+/g) ?? [];
    return {
      id: String(r[C.id]).trim(),
      status: "paid",
      payment_method: METHOD[String(r[C.metodo] ?? "").trim().toLowerCase()] ?? null,
      payment_type: "payment",
      amount_cents: cents(r[C.valor]),
      fee_cents: cents(r[C.taxa]),
      orderbump_cents: bumps.reduce((s, b) => s + cents(b.replace(/R\$\s*/, "")), 0),
      created_at: created,
      updated_at: created,
      customer_name: r[C.nome] ?? null,
      customer_email: r[C.email] ?? null,
      checkout_title: r[C.produto] ?? null,
      product_titles: r[C.produtos] ?? null,
      raw: { origem: "importacao-planilha" },
    };
  });

const url = process.env.SUPABASE_URL?.trim().replace(/\/(rest\/v1\/?)?$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não encontrados (use --env-file=.env)");
const db = createClient(url, key, { auth: { persistSession: false } });

const { data: existing, error } = await db.from("sales").select("id").in("id", sales.map((s) => s.id));
if (error) throw new Error(`Supabase: ${error.message}`);
const have = new Set(existing.map((e) => e.id));
const toInsert = sales.filter((s) => !have.has(s.id));

const sum = (list, k) => (list.reduce((a, s) => a + s[k], 0) / 100).toFixed(2).replace(".", ",");
const dates = sales.map((s) => s.created_at).sort();
console.log(`Linhas na planilha: ${all.length} | pagas: ${sales.length} | ignoradas (não pagas): ${all.length - sales.length}`);
if (dates.length) console.log(`Período das pagas: ${dates[0].slice(0, 10)} a ${dates.at(-1).slice(0, 10)}`);
console.log(`Já existem no banco: ${have.size} (não serão alteradas)`);
console.log(`A importar: ${toInsert.length} vendas | valor R$ ${sum(toInsert, "amount_cents")} | taxas R$ ${sum(toInsert, "fee_cents")}`);

if (!write) {
  console.log("\nSimulação: nada foi gravado. Rode de novo com --gravar para importar.");
  process.exit(0);
}
if (toInsert.length) {
  const { error: e2 } = await db.from("sales").insert(toInsert.map((s) => ({ ...s, received_at: new Date().toISOString() })));
  if (e2) throw new Error(`Supabase: ${e2.message}`);
}
console.log(`\nImportadas: ${toInsert.length} vendas.`);
