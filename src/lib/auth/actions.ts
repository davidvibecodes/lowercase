"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authProvider } from "./dev-provider";
import { createSessionValue, SESSION_COOKIE, sessionCookieOptions } from "./session-cookie";

export type LoginState = { error?: string };

export async function signInAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const result = await authProvider.signIn({ username });
  if (!result.ok) return { error: result.error };
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createSessionValue(result.user.id), sessionCookieOptions);
  redirect("/");
}

export async function signOutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
