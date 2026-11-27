import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession } from "./auth";

/** Garante que quem está acessando fez login (páginas e server actions). */
export async function requireSession() {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!isValidSession(value)) redirect("/login");
}
