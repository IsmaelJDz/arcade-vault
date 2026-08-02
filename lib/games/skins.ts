// Sistema de skins compartido de los juegos — sin React ni imports de Next.
// Cada juego define su propia paleta (XxxPalette + XXX_SKINS) en su motor;
// aquí solo viven los identificadores, las etiquetas y la persistencia.

export type SkinId = "clasico" | "neon" | "retro";

export const SKIN_IDS: SkinId[] = ["clasico", "neon", "retro"];

export const DEFAULT_SKIN: SkinId = "clasico";

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "CLÁSICO",
  neon: "NEÓN",
  retro: "RETRO",
};

// Persistencia por juego: una clave de localStorage por slug.
const storageKey = (gameId: string) => `av-skin:${gameId}`;

// Lee la skin guardada del juego; valida contra SKIN_IDS y cae en la default.
// SSR-safe: en el servidor no hay window y devuelve la default.
export function loadSkin(gameId: string): SkinId {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    const stored = window.localStorage.getItem(storageKey(gameId));
    return SKIN_IDS.includes(stored as SkinId) ? (stored as SkinId) : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

// Guarda la skin elegida para el juego. SSR-safe: no-op en el servidor.
export function saveSkin(gameId: string, skin: SkinId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(gameId), skin);
  } catch {
    // localStorage bloqueado (modo privado, etc.): la skin queda solo en memoria.
  }
}
