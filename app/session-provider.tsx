"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

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
// Evento propio para notificar cambios en la misma pestaña (el evento nativo
// "storage" solo dispara entre pestañas distintas).
const CHANGE_EVT = "av_session_change";

// --- Store externo de usuario (localStorage) leído con useSyncExternalStore ---
// getSnapshot debe devolver una referencia estable si el valor no cambió, así
// que cacheamos el último raw string y su objeto parseado.
let userCache: { raw: string | null; value: User | null } = {
  raw: null,
  value: null,
};

function getUserSnapshot(): User | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(USER_KEY);
  } catch {
    raw = null; // localStorage no disponible (modo privado): sesión en memoria.
  }
  if (raw !== userCache.raw) {
    let value: User | null = null;
    if (raw) {
      try {
        value = JSON.parse(raw) as User;
      } catch {
        value = null;
      }
    }
    userCache = { raw, value };
  }
  return userCache.value;
}

// En SSR / primer render de hidratación no hay localStorage: sin usuario.
function getServerUserSnapshot(): User | null {
  return null;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener("storage", cb);
  window.addEventListener(CHANGE_EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(CHANGE_EVT, cb);
  };
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVT));
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const user = useSyncExternalStore(
    subscribe,
    getUserSnapshot,
    getServerUserSnapshot
  );

  const login = (u: User | null) => {
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch {
      // ignora: sin persistencia si localStorage falla.
    }
    notify();
  };

  const signOut = () => {
    try {
      localStorage.removeItem(USER_KEY);
    } catch {
      // ignora.
    }
    notify();
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
