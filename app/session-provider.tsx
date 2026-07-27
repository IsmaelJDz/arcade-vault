"use client";

import type { AuthError, Session, User as SupabaseUser } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export interface User {
  name: string; // = user_metadata.display_name
  email: string;
}

export type AuthResult = { ok: true } | { ok: false; error: string };

// Contrato de guardado de marca (Spec 06): el llamador solo aporta juego y
// score; `user_id` y `player_name` los pone el provider desde la sesión, así que
// no se pueden falsear desde el cliente.
export type SaveScoreResult = { ok: boolean; error?: string };

interface SessionValue {
  user: User | null;
  loading: boolean; // true mientras se resuelve la sesión inicial
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  saveScore: (e: { game: string; score: number }) => Promise<SaveScoreResult>;
}

const SessionContext = createContext<SessionValue | null>(null);

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

  // Inserta la marca en `public.scores`. Solo autenticados: si no hay sesión no
  // inserta. `user_id`/`player_name` salen de la sesión, no del llamador; la
  // policy RLS `with check (auth.uid() = user_id)` respalda la propiedad.
  const saveScore = async (entry: { game: string; score: number }): Promise<SaveScoreResult> => {
    if (!user) {
      return { ok: false, error: "Inicia sesión para guardar tu marca." };
    }
    const {
      data: { user: su },
    } = await supabase.auth.getUser();
    if (!su) {
      return { ok: false, error: "Inicia sesión para guardar tu marca." };
    }
    const { error } = await supabase.from("scores").insert({
      game_id: entry.game,
      user_id: su.id,
      player_name: user.name,
      score: entry.score,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
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
