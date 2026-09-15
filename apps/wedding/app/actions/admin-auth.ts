"use server";

import { redirect } from "next/navigation";

import { createAdminAuthClient, userIsAdmin } from "@/lib/admin";

function loginError(message: string): never {
  redirect(`/admin/login?error=${encodeURIComponent(message)}`);
}

export async function loginAdminAction(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) loginError("יש להזין כתובת אימייל וסיסמה.");

  let client;
  try {
    client = await createAdminAuthClient();
  } catch (error) {
    console.error("Admin authentication is not configured", error);
    loginError("מערכת הניהול עדיין אינה זמינה.");
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) loginError("פרטי ההתחברות אינם נכונים.");
  if (!userIsAdmin(data.user)) {
    await client.auth.signOut();
    loginError("למשתמש הזה אין הרשאת ניהול.");
  }
  redirect("/admin");
}

export async function logoutAdminAction(): Promise<void> {
  const client = await createAdminAuthClient();
  await client.auth.signOut();
  redirect("/admin/login");
}
