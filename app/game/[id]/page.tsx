import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/games-db";
import { getLeaderboard } from "@/lib/scores";

// Detalle: server component que lee el juego y su leaderboard real desde DB
// (Spec 06). `notFound()` si el slug no existe. La navegación usa <Link>, así
// que no hace falta un client child.
export default async function GameDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const game = await getGame(id);
  if (!game) notFound();

  const scores = await getLeaderboard(id, 10);

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link className="btn xl pulse" href={`/play/${game.id}`}>
              ▶ JUGAR AHORA
            </Link>
            <Link className="btn ghost lg" href="/games">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 ? (
            <div
              style={{
                padding: "32px 12px",
                textAlign: "center",
                color: "var(--ink-faint)",
              }}
            >
              <div
                className="pixel"
                style={{
                  fontSize: 12,
                  color: "var(--cyan)",
                  marginBottom: 10,
                }}
              >
                SIN MARCAS AÚN
              </div>
              <div>Sé el primero en dejar tu marca.</div>
            </div>
          ) : (
            scores.map((r, i) => (
              <div
                key={r.rank}
                className={
                  "lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
                }
              >
                <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
                <div className="pl">
                  {r.name}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--ink-faint)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {r.date}
                  </div>
                </div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
