"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, safeEqual, sessionToken } from "@/lib/auth";

export async function login(formData: FormData) {
  const senha = String(formData.get("senha") ?? "");
  const expected = process.env.PAINEL_SENHA ?? "";
  if (!expected || !safeEqual(senha, expected)) redirect("/login?erro=1");
  (await cookies()).set(SESSION_COOKIE, sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
