"use client";

import type { AuthError, Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export interface User {
  name: string; // = user_metadata.display_name
  email: string;
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

interface SessionValue {
  user: User | null;
  loading: boolean; // true mientras se resuelve la sesión inicial
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  saveScore: (e: Omit<ScoreEntry, "at">) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const SCORES_KEY = "av_scores";

// Deriva el usuario de la app desde el usuario de Supabase Auth.
function toUser(su: SupabaseUser | null): User | null {
  if (!su) return null;
  const displayName =
    (su.user_metadata?.display_name as string | undefined) ?? su.email?.split("@")[0] ?? "PLAYER1";
  return { name: displayName.toUpperCase().slice(0, 10), email: su.email ?? "" };
}

// Traduce errores de Supabase Auth a mensajes en español para la UI.
function mapError(error: AuthError): string {
  const code = error.code ?? "";
  if (code === "invalid_credentials" || /invalid login/i.test(error.message)) {
    return "Correo o contraseña incorrectos.";
  }
  if (code === "email_not_confirmed" || /not confirmed/i.test(error.message)) {
    return "Debes confirmar tu correo antes de entrar. Revisa tu bandeja.";
  }
  if (code === "user_already_exists" || /already registered/i.test(error.message)) {
    return "Ya existe una cuenta con ese correo.";
  }
  if (code === "weak_password" || /password/i.test(error.message)) {
    return "La contraseña es demasiado débil (mínimo 6 caracteres).";
  }
  return error.message || "Algo salió mal. Inténtalo de nuevo.";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Sesión inicial (resuelve el estado de carga tras montar).
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(toUser(data.user));
      setLoading(false);
    });

    // Cambios posteriores (login, logout, refresh de token).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session: Session | null) => {
      setUser(toUser(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signUp = async (email: string, password: string, name: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name.toUpperCase().slice(0, 10) },
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined,
      },
    });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const saveScore = (entry: Omit<ScoreEntry, "at">) => {
    try {
      const all = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]") as ScoreEntry[];
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {
      // ignora: sin persistencia si localStorage falla.
    }
  };

  return (
    <SessionContext.Provider value={{ user, loading, signUp, signIn, signOut, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return ctx;
}
