import { checkHeaderToken } from "@/lib/auth";
import { isDemo, upsertSale } from "@/lib/db";
import { parseWiapyPayload } from "@/lib/wiapy";

// Recebe os avisos de venda da Wiapy.
// URL para cadastrar na Wiapy: https://SEU-PROJETO.vercel.app/api/webhooks/wiapy
export async function POST(request: Request) {
  if (!checkHeaderToken(request.headers.get("authorization"), process.env.WIAPY_WEBHOOK_TOKEN)) {
    return Response.json({ ok: false, error: "token inválido" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseWiapyPayload(body);
  if (parsed.kind === "ignored") {
    return Response.json({ ok: true, ignored: parsed.reason });
  }
  if (isDemo()) {
    return Response.json({ ok: true, demo: true, sale: parsed.sale.id });
  }

  try {
    const result = await upsertSale(parsed.sale, body);
    return Response.json({ ok: true, id: parsed.sale.id, result });
  } catch (e) {
    console.error("webhook wiapy:", e);
    // 500 faz a Wiapy (se ela reenviar) tentar de novo mais tarde.
    return Response.json({ ok: false, error: "erro ao salvar" }, { status: 500 });
  }
}

export function GET() {
  return Response.json({ ok: true, info: "Webhook da Wiapy ativo. A Wiapy envia POST para esta URL." });
}
