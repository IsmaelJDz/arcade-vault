// Lecturas del leaderboard real (Spec 06).
// Las filas de `public.scores` se leen server-side y se mapean a ScoreRow,
// la forma que consume el Hall.

import { createClient } from "@/lib/supabase/server";
import type { ScoreRow } from "@/lib/games";

// created_at (ISO) → 'DD/MM/YYYY', igual formato que usaba el mock.
function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

/**
 * Top N de un juego, ordenado por score desc y desempate por marca más antigua
 * (created_at asc). Devuelve [] si el juego no tiene scores (empty state).
 */
export async function getLeaderboard(gameId: string, limit = 12): Promise<ScoreRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r, i) => ({
    rank: i + 1,
    name: r.player_name,
    score: r.score,
    date: formatDate(r.created_at),
  }));
}
