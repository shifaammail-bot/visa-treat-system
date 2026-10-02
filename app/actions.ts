"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { ALL_BRANDS, BRAND_COOKIE, allowedIssuers, getIssuers } from "@/lib/issuers";

export async function signIn(_prev: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) return "Enter your email and password.";

  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) return "That email and password don't match.";

  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  await createClient().auth.signOut();
  cookies().delete(BRAND_COOKIE);
  redirect("/login");
}

export async function setBrand(value: string) {
  const session = await getSession();
  if (session.status !== "ok") return;

  const allowed = allowedIssuers(await getIssuers(), session.staff);
  const valid = value === ALL_BRANDS || allowed.some((i) => i.id === value);
  if (!valid) return;

  cookies().set(BRAND_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}
