import { login } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;
  return (
    <main className="login">
      <form action={login} className="card">
        <div className="brand"><span className="brand-dot" /> Painel de vendas</div>
        <label className="field">
          Senha
          <input type="password" name="senha" autoFocus required autoComplete="current-password" />
        </label>
        {erro === "sem-senha" ? (
          <p className="err-msg">A variável PAINEL_SENHA não está configurada no servidor. Cadastre-a na Vercel e faça Redeploy.</p>
        ) : erro ? (
          <p className="err-msg">Senha incorreta. Tente de novo.</p>
        ) : null}
        <button className="btn btn-primary" type="submit" style={{ justifyContent: "center" }}>Entrar</button>
      </form>
    </main>
  );
}
