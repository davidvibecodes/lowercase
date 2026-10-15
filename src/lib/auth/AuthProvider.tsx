"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "./provider";

const AuthContext = createContext<SessionUser | null>(null);

/** Exposes the signed-in user to client components (R4: UI never touches cookies). */
export function AuthProvider({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useUser(): SessionUser {
  const user = useContext(AuthContext);
  if (!user) throw new Error("useUser must be used inside <AuthProvider>");
  return user;
}
