"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, checkPassword, passwordRequired, sessionToken } from "@/lib/auth";

export async function login(formData: FormData) {
  if (!passwordRequired()) redirect("/login?erro=sem-senha");
  if (!checkPassword(String(formData.get("senha") ?? ""))) redirect("/login?erro=1");
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
