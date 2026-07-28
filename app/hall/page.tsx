import { getGames } from "@/lib/games-db";
import { getLeaderboard } from "@/lib/scores";
import HallClient, { type HallGame } from "./hall-client";

// Salón de la Fama: server component que lee, por juego, el leaderboard real
// desde DB (Spec 06). Las tabs (interactividad) viven en el client child, que
// recibe los datos ya cargados. Empty state para juegos sin scores.
export default async function HallOfFame() {
  const games = await getGames();
  const boards = await Promise.all(games.map((g) => getLeaderboard(g.id, 12)));
  const data: HallGame[] = games.map((g, i) => ({
    id: g.id,
    title: g.title,
    rows: boards[i],
  }));
  return <HallClient games={data} />;
}
