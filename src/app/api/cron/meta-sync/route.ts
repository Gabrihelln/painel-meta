import { checkHeaderToken } from "@/lib/auth";
import { isDemo } from "@/lib/db";
import { syncMeta } from "@/lib/sync";

export const maxDuration = 60;

// Chamado pela Vercel Cron e pelo GitHub Actions com "Authorization: Bearer CRON_SECRET".
// ?dias=30 busca um período maior (útil na primeira vez).
export async function GET(request: Request) {
  if (!checkHeaderToken(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ ok: false, error: "não autorizado" }, { status: 401 });
  }
  if (isDemo()) return Response.json({ ok: false, error: "modo demonstração: configure o Supabase" });
  const dias = Number(new URL(request.url).searchParams.get("dias") ?? "3");
  const result = await syncMeta(Number.isFinite(dias) ? dias : 3);
  return Response.json(result, { status: result.ok ? 200 : 502 });
}
