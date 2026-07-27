import { getGames } from "@/lib/games-db";
import LibraryClient from "./library-client";

// Biblioteca: server component que lee el catálogo desde DB (Spec 06) y delega
// la UI interactiva (búsqueda, chips, tilt) al client child.
export default async function Library() {
  const games = await getGames();
  return <LibraryClient games={games} />;
}
