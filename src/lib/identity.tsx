import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getUser, handleAuthCallback, onAuthChange, type CallbackResult, type User } from "@netlify/identity";

interface IdentityState {
  user: User | null;
  ready: boolean;
  /** Resultado de um link de e-mail (confirmação, recuperação de senha, convite). */
  callback: CallbackResult | null;
  clearCallback: () => void;
}

const IdentityContext = createContext<IdentityState | null>(null);

const CALLBACK_KEYS = ["confirmation_token", "recovery_token", "invite_token", "email_change_token", "access_token"];

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [callback, setCallback] = useState<CallbackResult | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthChange((_event, u) => {
      if (active) setUser(u);
    });
    (async () => {
      let cb: CallbackResult | null = null;
      try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        if (CALLBACK_KEYS.some((k) => params.has(k))) cb = await handleAuthCallback();
      } catch {
        cb = null;
      }
      const u = await getUser();
      if (!active) return;
      setUser(u);
      setCallback(cb);
      setReady(true);
    })();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <IdentityContext.Provider value={{ user, ready, callback, clearCallback: () => setCallback(null) }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity() {
  const s = useContext(IdentityContext);
  if (!s) throw new Error("IdentityProvider ausente");
  return s;
}

export const userDisplayName = (u: User | null | undefined) =>
  u?.name?.trim() || u?.email?.split("@")[0] || "Recruta";
