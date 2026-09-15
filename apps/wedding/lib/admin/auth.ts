import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createServerClient } from "@/lib/supabase/server";

export async function createAdminAuthClient() {
  return createServerClient();
}

export function configuredAdminEmails(value = process.env.ADMIN_EMAILS): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

export function userIsAdmin(user: User, allowlist = configuredAdminEmails()): boolean {
  const metadataRole = user.app_metadata?.role;
  const metadataRoles = user.app_metadata?.roles;
  const hasAdminRole = metadataRole === "admin"
    || metadataRole === "wedding_admin"
    || (Array.isArray(metadataRoles) && metadataRoles.some((role) => role === "admin" || role === "wedding_admin"));
  const allowedEmail = Boolean(user.email && allowlist.has(user.email.toLocaleLowerCase("en-US")));
  return hasAdminRole || allowedEmail;
}

export const getAuthenticatedAdmin = cache(async (): Promise<User | null> => {
  let client;
  try {
    client = await createAdminAuthClient();
  } catch {
    return null;
  }
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || !userIsAdmin(data.user)) return null;
  return data.user;
});

export async function requireAdmin(): Promise<User> {
  const user = await getAuthenticatedAdmin();
  if (!user) redirect("/admin/login");
  return user;
}
