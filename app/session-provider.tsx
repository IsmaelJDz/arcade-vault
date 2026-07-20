"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface User {
  name: string;
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
  at: number;
}

interface SessionValue {
  user: User | null;
  login: (u: User | null) => void;
  signOut: () => void;
  saveScore: (e: Omit<ScoreEntry, "at">) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Empieza deslogueado en SSR; localStorage se lee tras montar para evitar
  // mismatch de hidratación.
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (raw) setUser(JSON.parse(raw) as User);
    } catch {
      // localStorage no disponible (modo privado): sesión solo en memoria.
    }
  }, []);

  const login = (u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch {
      // ignora: la sesión sigue en memoria.
    }
  };

  const signOut = () => {
    setUser(null);
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignora.
    }
  };

  const saveScore = (entry: Omit<ScoreEntry, "at">) => {
    try {
      const all = JSON.parse(
        localStorage.getItem(SCORES_KEY) || "[]"
      ) as ScoreEntry[];
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {
      // ignora: sin persistencia si localStorage falla.
    }
  };

  return (
    <SessionContext.Provider value={{ user, login, signOut, saveScore }}>
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
