import { createContext, useContext } from "react";
import type { useAuthSession } from "../hooks/useAuthSession.js";

// AuthContext shares the full useAuthSession return value across the app tree.
// This avoids prop-drilling while keeping useAuthSession implementation unchanged.

export type AuthContextValue = ReturnType<typeof useAuthSession>;

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthContext.Provider");
  }
  return ctx;
}
