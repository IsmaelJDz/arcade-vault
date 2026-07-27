// Helpers server-side de lectura del catálogo (Spec 06).
// Aislados de `lib/games.ts` porque importan `lib/supabase/server.ts`
// (`next/headers`), que no puede vivir en el grafo de un client component.

import { createClient } from "@/lib/supabase/server";
import type { Category, Game, GameColor } from "@/lib/games";

// Fila cruda de `public.games` → objeto Game del dominio (cast de cat/color).
function rowToGame(row: {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
  best: number;
  plays: string;
}): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as Category,
    cover: row.cover,
    color: row.color as GameColor,
    best: row.best,
    plays: row.plays,
  };
}

/** Catálogo completo desde DB, en el orden sembrado (`sort`). */
export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, best, plays")
    .order("sort", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToGame);
}

/** Un juego por slug; `null` si no existe. */
export async function getGame(id: string): Promise<Game | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, best, plays")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToGame(data) : null;
}
