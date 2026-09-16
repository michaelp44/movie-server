"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { configuredAdminEmails, createAdminAuthClient, userIsAdmin } from "@/lib/admin";
import { consumeRateLimit } from "@/lib/rate-limit";

const credentialsSchema = z.object({
  username: z.string().trim().toLowerCase().pipe(z.literal("admin")),
  password: z.string().min(1).max(1024),
});

function loginError(message: string): never {
  redirect(`/admin/login?error=${encodeURIComponent(message)}`);
}

export async function loginAdminAction(formData: FormData): Promise<void> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) loginError("שם המשתמש או הסיסמה אינם נכונים.");

  const [email] = configuredAdminEmails();
  if (!email) loginError("מערכת הניהול עדיין אינה זמינה.");

  let loginAllowed = false;
  try {
    const requestHeaders = await headers();
    const identifier = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? requestHeaders.get("x-real-ip")
      ?? "unknown";
    loginAllowed = (await consumeRateLimit("admin-login", identifier, 10, 15 * 60)).allowed;
  } catch (error) {
    console.error("Admin login rate limiting failed", error);
    loginError("מערכת הניהול עדיין אינה זמינה.");
  }
  if (!loginAllowed) loginError("היו הרבה ניסיונות כניסה. המתינו כמה דקות ונסו שוב.");

  let client;
  try {
    client = await createAdminAuthClient();
  } catch (error) {
    console.error("Admin authentication is not configured", error);
    loginError("מערכת הניהול עדיין אינה זמינה.");
  }
  const { data, error } = await client.auth.signInWithPassword({ email, password: parsed.data.password });
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
