"use client";

import Link from "next/link";
import { notFound, useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";

import { type Game, GAMES } from "@/lib/games";
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  SKIN_LABELS,
  type SkinId,
  loadSkin,
  saveSkin,
} from "@/lib/games/skins";

import { type User, useSession } from "../../session-provider";
import AsteroidsGame, { type AsteroidsGameHandle } from "./asteroids-game";
import BloqueBusterGame, { type BloqueBusterGameHandle } from "./bloque-buster-game";
import CaidaGame, { type CaidaGameHandle } from "./caida-game";
import SerpentinaGame, { type SerpentinaGameHandle } from "./serpentina-game";

// Estado del guardado de marca en el modal de FIN.
type SaveState = "idle" | "saving" | "saved" | "error";

export default function GamePlayer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  // Juegos reales portados; el resto sigue en simulación (specs 05/07/08).
  if (game.id === "rocas") return <AsteroidsPlayer game={game} />;
  if (game.id === "caida") return <CaidaPlayer game={game} />;
  if (game.id === "bloque-buster") return <BloqueBusterPlayer game={game} />;
  if (game.id === "serpentina") return <SerpentinaPlayer game={game} />;
  return <SimulatedPlayer game={game} />;
}

// ── Reproductor real: Asteroids ───────────────────────────────────────────────
function AsteroidsPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const gameRef = useRef<AsteroidsGameHandle>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);

  const playerName = user ? user.name : "INVITADO";

  // Carga la skin persistida del juego al montar. Debe ser en un efecto (no en
  // el estado inicial): localStorage solo existe en cliente y leerlo durante el
  // render provocaría un mismatch de hidratación en el selector.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización única con localStorage
    setSkin(loadSkin(game.id));
  }, [game.id]);

  const changeSkin = (next: SkinId) => {
    setSkin(next);
    saveSkin(game.id, next);
  };

  const handleSave = async () => {
    setSaveState("saving");
    const res = await saveScore({ game: game.id, score });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveError(res.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      setSaveState("error");
    }
  };

  // FIN: fuerza el cierre de partida con el score actual (congela el motor).
  const endGame = () => {
    setPaused(true);
    setOver(true);
  };

  const restart = () => {
    gameRef.current?.restart();
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    setSaveError("");
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        playerName={playerName}
        score={score}
        lives={lives}
        level={level}
        paused={paused}
        skin={skin}
        onSkinChange={changeSkin}
        onPause={() => setPaused((p) => !p)}
        onEnd={endGame}
        onExit={() => router.push(`/game/${game.id}`)}
      />

      <div className="crt">
        <div className="crt-screen">
          <AsteroidsGame
            ref={gameRef}
            paused={paused}
            skin={skin}
            onScore={setScore}
            onLives={setLives}
            onLevel={setLevel}
            onGameOver={() => setOver(true)}
          />
          {paused && <PauseOverlay />}
        </div>
        <CrtBottom title={game.title} />
      </div>

      <div className="game-controls">
        <div className="controls-legend">
          <span className="keys">
            <kbd>◄</kbd>
            <kbd>►</kbd> ROTAR
            <kbd>▲</kbd> PROPULSAR
            <kbd>ESPACIO</kbd> DISPARAR
          </span>
        </div>
      </div>

      {over && (
        <EndModal
          score={score}
          user={user}
          saveState={saveState}
          saveError={saveError}
          onSave={handleSave}
          onRestart={restart}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}

// ── Reproductor real: Caída (Tetris) ─────────────────────────────────────────
function CaidaPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const gameRef = useRef<CaidaGameHandle>(null);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const playerName = user ? user.name : "INVITADO";

  const handleSave = async () => {
    setSaveState("saving");
    const res = await saveScore({ game: game.id, score });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveError(res.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      setSaveState("error");
    }
  };

  // FIN: fuerza el cierre de partida con el score actual (congela el motor).
  const endGame = () => {
    setPaused(true);
    setOver(true);
  };

  const restart = () => {
    gameRef.current?.restart();
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    setSaveError("");
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        playerName={playerName}
        score={score}
        lines={lines}
        level={level}
        paused={paused}
        onPause={() => setPaused((p) => !p)}
        onEnd={endGame}
        onExit={() => router.push(`/game/${game.id}`)}
      />

      <div className="crt">
        <div className="crt-screen">
          <CaidaGame
            ref={gameRef}
            paused={paused}
            onScore={setScore}
            onLines={setLines}
            onLevel={setLevel}
            onGameOver={() => setOver(true)}
          />
          {paused && <PauseOverlay />}
        </div>
        <CrtBottom title={game.title} />
      </div>

      <div className="game-controls">
        <div className="controls-legend">
          <span className="keys">
            <kbd>◄</kbd>
            <kbd>►</kbd> MOVER
            <kbd>▲</kbd>
            <kbd>X</kbd> ROTAR
            <kbd>▼</kbd> BAJAR
            <kbd>ESPACIO</kbd> CAER
          </span>
        </div>
      </div>

      {over && (
        <EndModal
          score={score}
          user={user}
          saveState={saveState}
          saveError={saveError}
          onSave={handleSave}
          onRestart={restart}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}

// ── Reproductor real: Bloque Buster (Arkanoid) ───────────────────────────────
function BloqueBusterPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const gameRef = useRef<BloqueBusterGameHandle>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);

  const playerName = user ? user.name : "INVITADO";

  // Carga la skin persistida del juego al montar. Debe ser en un efecto (no en
  // el estado inicial): localStorage solo existe en cliente y leerlo durante el
  // render provocaría un mismatch de hidratación en el selector.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización única con localStorage
    setSkin(loadSkin(game.id));
  }, [game.id]);

  const changeSkin = (next: SkinId) => {
    setSkin(next);
    saveSkin(game.id, next);
  };

  const handleSave = async () => {
    setSaveState("saving");
    const res = await saveScore({ game: game.id, score });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveError(res.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      setSaveState("error");
    }
  };

  // FIN: fuerza el cierre de partida con el score actual (congela el motor).
  const endGame = () => {
    setPaused(true);
    setOver(true);
  };

  const restart = () => {
    gameRef.current?.restart();
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    setSaveError("");
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        playerName={playerName}
        score={score}
        lives={lives}
        level={level}
        paused={paused}
        skin={skin}
        onSkinChange={changeSkin}
        onPause={() => setPaused((p) => !p)}
        onEnd={endGame}
        onExit={() => router.push(`/game/${game.id}`)}
      />

      <div className="crt">
        <div className="crt-screen">
          <BloqueBusterGame
            ref={gameRef}
            paused={paused}
            skin={skin}
            onScore={setScore}
            onLives={setLives}
            onLevel={setLevel}
            onGameOver={() => setOver(true)}
          />
          {paused && <PauseOverlay />}
        </div>
        <CrtBottom title={game.title} />
      </div>

      <div className="game-controls">
        <div className="controls-legend">
          <span className="keys">
            <kbd>◄</kbd>
            <kbd>►</kbd> MOVER
          </span>
        </div>
      </div>

      {over && (
        <EndModal
          score={score}
          user={user}
          saveState={saveState}
          saveError={saveError}
          onSave={handleSave}
          onRestart={restart}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}

// ── Reproductor real: Serpentina (Snake) ─────────────────────────────────────
function SerpentinaPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();
  const gameRef = useRef<SerpentinaGameHandle>(null);

  const [score, setScore] = useState(0);
  const [length, setLength] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);

  const playerName = user ? user.name : "INVITADO";

  // Carga la skin persistida del juego al montar. Debe ser en un efecto (no en
  // el estado inicial): localStorage solo existe en cliente y leerlo durante el
  // render provocaría un mismatch de hidratación en el selector.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización única con localStorage
    setSkin(loadSkin(game.id));
  }, [game.id]);

  const changeSkin = (next: SkinId) => {
    setSkin(next);
    saveSkin(game.id, next);
  };

  const handleSave = async () => {
    setSaveState("saving");
    const res = await saveScore({ game: game.id, score });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveError(res.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      setSaveState("error");
    }
  };

  // FIN: fuerza el cierre de partida con el score actual (congela el motor).
  const endGame = () => {
    setPaused(true);
    setOver(true);
  };

  const restart = () => {
    gameRef.current?.restart();
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    setSaveError("");
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        playerName={playerName}
        score={score}
        length={length}
        level={level}
        paused={paused}
        skin={skin}
        onSkinChange={changeSkin}
        onPause={() => setPaused((p) => !p)}
        onEnd={endGame}
        onExit={() => router.push(`/game/${game.id}`)}
      />

      <div className="crt">
        <div className="crt-screen">
          <SerpentinaGame
            ref={gameRef}
            paused={paused}
            skin={skin}
            onScore={setScore}
            onLength={setLength}
            onLevel={setLevel}
            onGameOver={() => setOver(true)}
          />
          {paused && <PauseOverlay />}
        </div>
        <CrtBottom title={game.title} />
      </div>

      <div className="game-controls">
        <div className="controls-legend">
          <span className="keys">
            <kbd>◄</kbd>
            <kbd>►</kbd>
            <kbd>▲</kbd>
            <kbd>▼</kbd> MOVER
          </span>
        </div>
      </div>

      {over && (
        <EndModal
          score={score}
          user={user}
          saveState={saveState}
          saveError={saveError}
          onSave={handleSave}
          onRestart={restart}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}

// ── Reproductor simulado (resto de juegos, sin cambios de comportamiento) ──────
function SimulatedPlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user, saveScore } = useSession();

  const [score, setScore] = useState(0);
  const [lives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  const playerName = user ? user.name : "INVITADO";

  const handleSave = async () => {
    setSaveState("saving");
    const res = await saveScore({ game: game.id, score });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveError(res.error ?? "No se pudo guardar. Inténtalo de nuevo.");
      setSaveState("error");
    }
  };

  // Nivel derivado del score (sube uno cada 2500 puntos): valor puro, sin estado.
  const level = 1 + Math.floor(score / 2500);

  // Ticker de puntos falso (simulación visual). Solo en cliente, dentro del
  // effect: nunca en el cuerpo del render (evita mismatch de SSR).
  useEffect(() => {
    if (over || paused) return;
    const t = setInterval(() => setScore((s) => s + Math.floor(10 + Math.random() * 90)), 220);
    return () => clearInterval(t);
  }, [over, paused]);

  const restart = () => {
    setScore(0);
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    setSaveError("");
  };

  return (
    <div className="av-player fade-in">
      <PlayerHud
        playerName={playerName}
        score={score}
        lives={lives}
        level={level}
        paused={paused}
        onPause={() => setPaused((p) => !p)}
        onEnd={() => setOver(true)}
        onExit={() => router.push(`/game/${game.id}`)}
      />

      <div className="crt">
        <div className="crt-screen">
          <div className="game-arena">
            <div className="grid-floor"></div>
            <div className="enemy e1"></div>
            <div className="enemy e2"></div>
            <div className="enemy e3"></div>
            <div className="player-ship"></div>
          </div>
          {paused && <PauseOverlay />}
        </div>
        <CrtBottom title={game.title} />
      </div>

      {over && (
        <EndModal
          score={score}
          user={user}
          saveState={saveState}
          saveError={saveError}
          onSave={handleSave}
          onRestart={restart}
          onExit={() => router.push("/games")}
        />
      )}
    </div>
  );
}

// ── Chrome compartido ─────────────────────────────────────────────────────────
function PlayerHud({
  playerName,
  score,
  lives,
  lines,
  length,
  level,
  paused,
  skin,
  onSkinChange,
  onPause,
  onEnd,
  onExit,
}: {
  playerName: string;
  score: number;
  lives?: number;
  lines?: number;
  length?: number;
  level: number;
  paused: boolean;
  skin?: SkinId;
  onSkinChange?: (skin: SkinId) => void;
  onPause: () => void;
  onEnd: () => void;
  onExit: () => void;
}) {
  // Stat central adaptable por juego: Líneas (Tetris), Longitud (Snake) o Vidas (resto).
  const showLines = lines !== undefined;
  const showLength = length !== undefined;
  const isNumericStat = showLines || showLength;
  const centralLabel = showLines ? "Líneas" : showLength ? "Longitud" : "Vidas";
  const centralValue = showLines
    ? String(lines)
    : showLength
      ? String(length)
      : "♥ ".repeat(lives ?? 0).trim() || "—";
  return (
    <div className="player-hud">
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <div className="hud-stat">
          <div className="l">Jugador</div>
          <div className="v" style={{ color: "var(--ink)" }}>
            {playerName}
          </div>
        </div>
        <div className="hud-stat">
          <div className="l">Puntuación</div>
          <div className="v">{score.toLocaleString("es-ES")}</div>
        </div>
        <div className={`hud-stat ${isNumericStat ? "lines" : "lives"}`}>
          <div className="l">{centralLabel}</div>
          <div className="v">{centralValue}</div>
        </div>
        <div className="hud-stat level">
          <div className="l">Nivel</div>
          <div className="v">{String(level).padStart(2, "0")}</div>
        </div>
      </div>
      {skin !== undefined && onSkinChange && (
        <div className="skin-picker" role="group" aria-label="Skin del juego">
          {SKIN_IDS.map((id) => (
            <button
              key={id}
              className={`btn ghost skin-btn${skin === id ? " active" : ""}`}
              aria-pressed={skin === id}
              onClick={() => onSkinChange(id)}
            >
              {SKIN_LABELS[id]}
            </button>
          ))}
        </div>
      )}
      <div className="hud-actions">
        <button className="btn yellow" onClick={onPause}>
          {paused ? "REANUDAR" : "PAUSA"}
        </button>
        <button className="btn magenta" onClick={onEnd}>
          FIN
        </button>
        <button className="btn ghost" onClick={onExit}>
          SALIR
        </button>
      </div>
    </div>
  );
}

function PauseOverlay() {
  return (
    <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
      <div>
        <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
          EN PAUSA
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-dim)",
            marginTop: 10,
            letterSpacing: "0.16em",
          }}
        >
          PULSA REANUDAR PARA CONTINUAR
        </div>
      </div>
    </div>
  );
}

function CrtBottom({ title }: { title: string }) {
  return (
    <div className="crt-bottom">
      <span className="led">SEÑAL OK</span>
      <span>{title} · CRT-83 · 60 HZ</span>
      <span>CARGA · 1MB</span>
    </div>
  );
}

function EndModal({
  score,
  user,
  saveState,
  saveError,
  onSave,
  onRestart,
  onExit,
}: {
  score: number;
  user: User | null;
  saveState: SaveState;
  saveError: string;
  onSave: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  return (
    <div className="modal-bd">
      <div className="modal">
        <h2>FIN DEL JUEGO</h2>
        <div className="final-label">PUNTUACIÓN FINAL</div>
        <div className="final">{score.toLocaleString("es-ES")}</div>

        {user ? (
          saveState === "saved" ? (
            <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
          ) : (
            <div className="input-row" style={{ flexDirection: "column", gap: 8 }}>
              <div
                className="mono"
                style={{
                  fontSize: 11,
                  color: "var(--ink-dim)",
                  letterSpacing: "0.14em",
                }}
              >
                GUARDAR COMO <b style={{ color: "var(--cyan)" }}>{user.name}</b>
              </div>
              <button className="btn yellow" onClick={onSave} disabled={saveState === "saving"}>
                {saveState === "saving" ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
              </button>
              {saveState === "error" && (
                <div className="mono" style={{ fontSize: 11, color: "var(--magenta)" }}>
                  {saveError}
                </div>
              )}
            </div>
          )
        ) : (
          <div
            className="mono"
            style={{
              fontSize: 12,
              color: "var(--ink-dim)",
              letterSpacing: "0.06em",
              lineHeight: 1.6,
              margin: "4px 0 8px",
            }}
          >
            Inicia sesión para guardar tu marca.{" "}
            <Link href="/login" style={{ color: "var(--yellow)" }}>
              ENTRAR
            </Link>
          </div>
        )}

        <div className="actions">
          <button className="btn" onClick={onRestart}>
            JUGAR DE NUEVO
          </button>
          <button className="btn magenta" onClick={onExit}>
            VOLVER AL VAULT
          </button>
        </div>
      </div>
    </div>
  );
}
