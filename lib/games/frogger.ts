// Motor del juego Frogger — construido desde cero (spec game-jam/frogger/01).
// Mismo contrato que lib/games/serpentina.ts y lib/games/asteroids.ts: todo el
// estado vive dentro de initFrogger(), nada toca el DOM al importar, y la UI
// (HUD React, pausa, modal de fin) la pone el wrapper.
//
// Mapa vertical de 16 × 14 celdas de 40 px (640 × 560 px de resolución interna,
// escalada por CSS). Filas de arriba (0) hacia abajo (13):
//
//   0        bocas destino (5 bocas de 2 columnas) + barra de tiempo
//   1 – 6    río (troncos y grupos de tortugas)
//   7        franja segura intermedia
//   8 – 12   carretera (coches y camiones)
//   13       base de inicio

import type { SkinId } from "./skins";

export interface FroggerHandlers {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface FroggerControls {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  setSkin: (skin: SkinId) => void;
}

// ── Cuadrícula y zonas ───────────────────────────────────────────────────────
export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px
export const CANVAS_W = COLS * CELL; // 640
export const CANVAS_H = ROWS * CELL; // 560

const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

// ── Reglas de juego ──────────────────────────────────────────────────────────
const START_LIVES = 3;
const HOP_MS = 120; // duración de la animación de salto
const GOAL_COUNT = 5; // bocas destino por ronda
const GOAL_WIDTH = 2; // columnas por boca

const POINTS_PER_ROW = 10; // avanzar a una fila nueva (primera vez en la ronda)
const POINTS_PER_GOAL = 50; // ocupar una boca
const POINTS_PER_ROUND = 200; // completar las 5 bocas
const TIME_BONUS_PER_SEC = 10; // bonus por segundo restante al ocupar una boca

const BASE_TIME = 15; // segundos por ronda al nivel 1
const TIME_STEP = 1; // cuánto se acorta por nivel
const MIN_TIME = 8; // suelo del temporizador
const SPEED_PER_LEVEL = 0.15; // +15 % de velocidad por nivel

// Ciclo de inmersión de las tortugas (segundos).
const TURTLE_UP_S = 3;
const TURTLE_DOWN_S = 1.5;

// ── Tipos locales ────────────────────────────────────────────────────────────
export type Direction = "up" | "down" | "left" | "right";

export type EntityType = "car" | "truck" | "log" | "turtle";

export interface Entity {
  col: number; // columna izquierda, en celdas (float)
  width: number; // ancho en celdas
  type: EntityType;
  submerged?: boolean; // solo tortugas: sin soporte mientras es true
  phase?: number; // solo tortugas: desfase del ciclo de inmersión (s)
  tint?: number; // índice de color dentro de la paleta del tipo
}

export interface Lane {
  row: number;
  speed: number; // px por frame a 60 fps (se convierte a celdas en update)
  dir: 1 | -1;
  entities: Entity[];
}

export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number; // ms transcurridos de la animación de salto
  targetCol: number;
  targetRow: number;
}

// ── Paleta por skin (solo colores del canvas; el chrome queda fuera) ─────────
export interface FroggerPalette {
  carretera: string; // fondo de las filas de carretera
  carril: string; // línea discontinua entre carriles
  rio: string; // fondo de las filas de río
  seguro: string; // franjas seguras (inicio e intermedia)
  metaFondo: string; // fondo de la fila de bocas
  metaHueco: string; // boca libre
  metaBorde: string; // borde de la boca
  metaOcupada: string; // silueta de rana en una boca ocupada
  coches: string[]; // colores de carrocería de los coches
  camion: string; // caja del camión
  camionCabina: string; // cabina del camión
  rueda: string; // ruedas de coches y camiones
  tronco: string; // cuerpo del tronco
  troncoVeta: string; // vetas del tronco
  tortuga: string; // caparazón visible
  tortugaEscama: string; // patrón del caparazón
  tortugaSumergida: string; // contorno de la tortuga bajo el agua
  rana: string; // cuerpo de la rana
  ranaPata: string; // patas y contorno
  ranaOjo: string; // ojos
  hudTexto: string; // score / nivel del HUD interno
  tiempoAlto: string; // barra de tiempo > 50 %
  tiempoMedio: string; // barra de tiempo 20–50 %
  tiempoBajo: string; // barra de tiempo < 20 %
}

export const FROGGER_SKINS: Record<SkinId, FroggerPalette> = {
  // Arcade clásico: asfalto negro, río azul profundo, rana verde lima.
  clasico: {
    carretera: "#0d0d12",
    carril: "rgba(255, 255, 255, 0.28)",
    rio: "#062a52",
    seguro: "#123a1c",
    metaFondo: "#0a2412",
    metaHueco: "#06160c",
    metaBorde: "#ffd447",
    metaOcupada: "#00ff88",
    coches: ["#ff3b3b", "#ffd447", "#4db8ff", "#ff8a3d"],
    camion: "#c9ced8",
    camionCabina: "#7d8695",
    rueda: "#101018",
    tronco: "#7a4a24",
    troncoVeta: "#5a3316",
    tortuga: "#2fbf6b",
    tortugaEscama: "#0d6b39",
    tortugaSumergida: "rgba(47, 191, 107, 0.28)",
    rana: "#4dff5a",
    ranaPata: "#1f9e2c",
    ranaOjo: "#ffffff",
    hudTexto: "#e8f4ff",
    tiempoAlto: "#00ff88",
    tiempoMedio: "#ffd447",
    tiempoBajo: "#ff3b3b",
  },
  // Synthwave: violeta y cian saturados, rana magenta sobre río eléctrico.
  neon: {
    carretera: "#12021f",
    carril: "rgba(0, 240, 255, 0.35)",
    rio: "#0b1a63",
    seguro: "#1a0b3d",
    metaFondo: "#170a33",
    metaHueco: "#0b0420",
    metaBorde: "#f5ff00",
    metaOcupada: "#ff2fd6",
    coches: ["#ff2fd6", "#f5ff00", "#00f0ff", "#ff6a3d"],
    camion: "#c9a7ff",
    camionCabina: "#7a4dff",
    rueda: "#1a0b2e",
    tronco: "#8a4dd6",
    troncoVeta: "#5c2f96",
    tortuga: "#00f0ff",
    tortugaEscama: "#0077a3",
    tortugaSumergida: "rgba(0, 240, 255, 0.25)",
    rana: "#ff2fd6",
    ranaPata: "#a3128a",
    ranaOjo: "#f5ff00",
    hudTexto: "#e6f7ff",
    tiempoAlto: "#00f0ff",
    tiempoMedio: "#f5ff00",
    tiempoBajo: "#ff2fd6",
  },
  // CRT de época: fósforo ámbar y verde sobre negro cálido.
  retro: {
    carretera: "#0c0a04",
    carril: "rgba(255, 176, 0, 0.3)",
    rio: "#14200a",
    seguro: "#1c1405",
    metaFondo: "#161003",
    metaHueco: "#0a0702",
    metaBorde: "#ffb000",
    metaOcupada: "#33ff33",
    coches: ["#ffb000", "#ff6a3d", "#ffd88a", "#c98a00"],
    camion: "#d9c08a",
    camionCabina: "#a37a1f",
    rueda: "#0a0702",
    tronco: "#8a5a1f",
    troncoVeta: "#5c3a10",
    tortuga: "#33ff33",
    tortugaEscama: "#1a8a1a",
    tortugaSumergida: "rgba(51, 255, 51, 0.24)",
    rana: "#8aff8a",
    ranaPata: "#2fae2f",
    ranaOjo: "#ffb000",
    hudTexto: "#ffd88a",
    tiempoAlto: "#33ff33",
    tiempoMedio: "#ffb000",
    tiempoBajo: "#ff6a3d",
  },
};

// ── Utils puras ──────────────────────────────────────────────────────────────
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Columna izquierda de la boca destino i (5 bocas de 2 columnas repartidas en 16).
// Huecos de 1 columna entre bocas y en los extremos: 1 + i*3 → 1, 4, 7, 10, 13.
function goalCol(i: number): number {
  return 1 + i * 3;
}

// Índice de la boca que cubre una columna, o -1 si cae en el muro.
function goalIndexAt(col: number): number {
  for (let i = 0; i < GOAL_COUNT; i++) {
    const left = goalCol(i);
    if (col >= left && col < left + GOAL_WIDTH) return i;
  }
  return -1;
}

// ── Mapa de carriles ─────────────────────────────────────────────────────────
// Plantilla fija por fila: tipo de entidad, ancho, separación deseada (en celdas,
// de borde izquierdo a borde izquierdo) y desfase inicial para escalonar carriles.
interface LaneSpec {
  row: number;
  speed: number; // px/frame a 60 fps en el nivel 1
  dir: 1 | -1;
  type: EntityType;
  width: number; // celdas
  spacing: number; // separación deseada entre entidades del carril
  offset: number; // desfase inicial (fracción de `spacing`)
}

// Carretera: filas 8–12, sentidos alternos, velocidades de 1.5 a 4 px/frame.
const ROAD_SPECS: LaneSpec[] = [
  { row: 12, speed: 1.5, dir: 1, type: "car", width: 1, spacing: 5, offset: 0 },
  { row: 11, speed: 2.2, dir: -1, type: "truck", width: 2, spacing: 6.5, offset: 0.4 },
  { row: 10, speed: 1.8, dir: 1, type: "car", width: 1, spacing: 4.5, offset: 0.7 },
  { row: 9, speed: 4, dir: -1, type: "car", width: 1, spacing: 6, offset: 0.2 },
  { row: 8, speed: 2.6, dir: 1, type: "truck", width: 3, spacing: 7.5, offset: 0.5 },
];

// Río: filas 1–6, velocidades de 1 a 3 px/frame; troncos de 2–4 celdas y grupos
// de tortugas de 2–3. La fila 6 es la primera que pisa la rana al salir del asfalto.
const RIVER_SPECS: LaneSpec[] = [
  { row: 6, speed: 1.4, dir: 1, type: "log", width: 3, spacing: 6, offset: 0 },
  { row: 5, speed: 1.6, dir: -1, type: "turtle", width: 3, spacing: 5.5, offset: 0.5 },
  { row: 4, speed: 1, dir: 1, type: "log", width: 4, spacing: 7.5, offset: 0.3 },
  { row: 3, speed: 2.4, dir: 1, type: "log", width: 2, spacing: 5, offset: 0.8 },
  { row: 2, speed: 1.8, dir: -1, type: "turtle", width: 2, spacing: 5, offset: 0.15 },
  { row: 1, speed: 1.2, dir: -1, type: "log", width: 3, spacing: 6.5, offset: 0.6 },
];

// Construye un carril a partir de su plantilla.
//
// El recorrido de una entidad va de `col = -width` a `col = COLS` (longitud
// COLS + width) y al salir reaparece por el lado opuesto. Repartir las entidades
// en pasos exactos de (COLS + width) / n mantiene los huecos constantes ronda
// tras ronda, en vez de irse acumulando por el reciclado.
function buildLane(spec: LaneSpec): Lane {
  const path = COLS + spec.width;
  let count = Math.max(2, Math.round(path / spec.spacing));
  // Garantiza al menos 1 celda de hueco entre entidades: si no cabe, quita una.
  while (count > 2 && path / count - spec.width < 1) count--;
  const step = path / count;

  const entities: Entity[] = [];
  for (let i = 0; i < count; i++) {
    const col = -spec.width + ((i + spec.offset) % count) * step;
    const entity: Entity = { col, width: spec.width, type: spec.type, tint: i };
    if (spec.type === "turtle") {
      // Cada grupo bucea en un momento distinto del ciclo (nunca todos a la vez).
      entity.phase = (i / count) * (TURTLE_UP_S + TURTLE_DOWN_S);
      entity.submerged = false;
    }
    entities.push(entity);
  }
  return { row: spec.row, speed: spec.speed, dir: spec.dir, entities };
}

// Carriles de la ronda `level`: misma plantilla, todo un 15 % más rápido por nivel.
function buildLanes(level: number): Lane[] {
  const mult = Math.pow(1 + SPEED_PER_LEVEL, level - 1);
  return [...RIVER_SPECS, ...ROAD_SPECS].map((spec) => {
    const lane = buildLane(spec);
    lane.speed = spec.speed * mult;
    return lane;
  });
}

// Segundos de la ronda `level`: 15 s al nivel 1, −1 s por nivel con suelo de 8 s.
function roundTime(level: number): number {
  return Math.max(MIN_TIME, BASE_TIME - (level - 1) * TIME_STEP);
}

// Filas donde la rana flota sobre el río.
const isRiverRow = (row: number) => row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
// Filas de asfalto.
const isRoadRow = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;

type GameState = "playing" | "gameover";

export function initFrogger(
  canvas: HTMLCanvasElement,
  handlers: FroggerHandlers,
  options?: { skin?: SkinId },
): FroggerControls {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // Paleta activa: mutable para que setSkin() cambie los colores en vivo.
  let palette: FroggerPalette = FROGGER_SKINS[options?.skin ?? "clasico"];

  // ── Estado de la partida (por instancia) ───────────────────────────────────
  let lanes: Lane[];
  let frog: Frog;
  let goals: boolean[]; // boca ocupada?
  let visitedRows: boolean[]; // filas ya puntuadas en la ronda (+10 la primera vez)
  let score: number;
  let lives: number;
  let level: number;
  let timeLeft: number; // segundos restantes de la ronda
  let clock: number; // segundos acumulados (ciclo de inmersión de las tortugas)
  let pendingDir: Direction | null;
  let state: GameState;

  // Últimos valores emitidos (para disparar callbacks solo en cambios).
  let lastScore = -1;
  let lastLives = -1;
  let lastLevel = -1;
  let gameOverEmitted = false;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      handlers.onScore(score);
    }
    if (lives !== lastLives) {
      lastLives = lives;
      handlers.onLives(lives);
    }
    if (level !== lastLevel) {
      lastLevel = level;
      handlers.onLevel(level);
    }
    if (state === "gameover" && !gameOverEmitted) {
      gameOverEmitted = true;
      handlers.onGameOver(score);
    }
  }

  // ── Input (por instancia) ──────────────────────────────────────────────────
  const KEY_DIRS: Record<string, Direction> = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };

  // El listener va en `window` (no en `document`) porque los controles táctiles
  // de la spec 10 despachan sus KeyboardEvent sobre window.
  const onKeyDown = (e: KeyboardEvent) => {
    const dir = KEY_DIRS[e.code];
    if (!dir) return;
    e.preventDefault();
    if (state !== "playing") return;
    pendingDir = dir;
  };

  // ── Arranque de ronda / partida ────────────────────────────────────────────
  function placeFrog() {
    const col = Math.floor(COLS / 2);
    frog = {
      col,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: col,
      targetRow: ROW_START,
    };
    pendingDir = null;
  }

  function startRound() {
    lanes = buildLanes(level);
    goals = new Array(GOAL_COUNT).fill(false);
    visitedRows = new Array(ROWS).fill(false);
    visitedRows[ROW_START] = true;
    timeLeft = roundTime(level);
    placeFrog();
  }

  function initGame() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    clock = 0;
    state = "playing";
    gameOverEmitted = false;
    startRound();
  }

  // ── Colisiones y soporte ───────────────────────────────────────────────────
  // La rana ocupa una celda; se la representa por su centro para decidir sobre
  // qué entidad está (más indulgente y estable que un solape AABB completo).
  const frogCenter = () => frog.col + 0.5;

  const covers = (e: Entity, col: number) => col >= e.col && col < e.col + e.width;

  // ¿Hay un vehículo bajo la rana en su carril de carretera?
  function checkRoadCollision(): boolean {
    const lane = lanes.find((l) => l.row === frog.row);
    if (!lane || !isRoadRow(frog.row)) return false;
    const col = frogCenter();
    return lane.entities.some((e) => covers(e, col));
  }

  // Entidad de río que sostiene a la rana, o null si está sobre el agua.
  // Una tortuga sumergida no sostiene: el jugador se hunde con ella.
  function getSupport(): Entity | null {
    const lane = lanes.find((l) => l.row === frog.row);
    if (!lane || !isRiverRow(frog.row)) return null;
    const col = frogCenter();
    const support = lane.entities.find((e) => covers(e, col));
    if (!support) return null;
    if (support.type === "turtle" && support.submerged) return null;
    return support;
  }

  // Llegada a la fila de bocas: ocupa una libre o muere contra el muro / una ocupada.
  function checkGoal() {
    const i = goalIndexAt(Math.round(frog.col));
    if (i === -1 || goals[i]) {
      killFrog();
      return;
    }
    goals[i] = true;
    score += POINTS_PER_GOAL + Math.ceil(timeLeft) * TIME_BONUS_PER_SEC;
    if (goals.every(Boolean)) completeRound();
    else {
      // Siguiente rana: vuelve a la base con el temporizador reiniciado.
      placeFrog();
      timeLeft = roundTime(level);
    }
  }

  // Resolución de la celda de destino al terminar el salto.
  function resolveLanding() {
    if (frog.row === ROW_GOALS) {
      checkGoal();
      return;
    }
    if (isRoadRow(frog.row) && checkRoadCollision()) {
      killFrog();
      return;
    }
    if (isRiverRow(frog.row) && !getSupport()) {
      killFrog();
      return;
    }
    // +10 por cada fila alcanzada por primera vez en la ronda.
    if (!visitedRows[frog.row]) {
      visitedRows[frog.row] = true;
      score += POINTS_PER_ROW;
    }
  }

  // ── Ronda completada ───────────────────────────────────────────────────────
  // Las 5 bocas llenas: bonus, siguiente nivel y mapa reconstruido más rápido.
  function completeRound() {
    score += POINTS_PER_ROUND;
    level++;
    startRound(); // vacía bocas, reconstruye carriles, resetea tiempo y rana
  }

  // ── Muerte de la rana ──────────────────────────────────────────────────────
  // Atropello, agua, tortuga sumergida, salir por un lateral del río o tiempo
  // agotado. Con 0 vidas la partida termina; emitChanges() dispara onLives(0)
  // antes que onGameOver(score).
  function killFrog() {
    lives--;
    if (lives <= 0) {
      lives = 0;
      state = "gameover";
      return;
    }
    placeFrog();
    timeLeft = roundTime(level);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dtMs: number) {
    if (state !== "playing") return;
    const dtS = dtMs / 1000;
    clock += dtS;

    // 1. Entidades: avance horizontal y reciclado por el lado opuesto.
    //    `speed` está en px/frame a 60 fps → celdas = speed / CELL por frame.
    for (const lane of lanes) {
      const delta = ((lane.speed / CELL) * lane.dir * dtMs) / 16;
      for (const e of lane.entities) {
        e.col += delta;
        if (lane.dir === 1 && e.col >= COLS) e.col = -e.width;
        else if (lane.dir === -1 && e.col <= -e.width) e.col = COLS;
        // Tortugas: ciclo visible → sumergida, escalonado por `phase`.
        if (e.type === "turtle") {
          const cycle = TURTLE_UP_S + TURTLE_DOWN_S;
          e.submerged = (clock + (e.phase ?? 0)) % cycle >= TURTLE_UP_S;
        }
      }
    }

    // 2. Rana: inicio y avance del salto discreto de una celda.
    if (!frog.animating && pendingDir) {
      const dir = pendingDir;
      pendingDir = null;
      const dCol = dir === "left" ? -1 : dir === "right" ? 1 : 0;
      const dRow = dir === "up" ? -1 : dir === "down" ? 1 : 0;
      const targetCol = Math.round(frog.col) + dCol;
      const targetRow = frog.row + dRow;
      // Los bordes laterales y el borde inferior no se pueden cruzar.
      if (targetCol >= 0 && targetCol <= COLS - 1 && targetRow >= 0 && targetRow <= ROW_START) {
        frog.animating = true;
        frog.animT = 0;
        frog.targetCol = targetCol;
        frog.targetRow = targetRow;
      }
    } else if (frog.animating) {
      frog.animT += dtMs;
      if (frog.animT >= HOP_MS) {
        frog.col = frog.targetCol;
        frog.row = frog.targetRow;
        frog.animating = false;
        frog.animT = 0;
        resolveLanding();
        if (state !== "playing") return;
      }
    }

    // 3. Río: la rana viaja con el tronco/tortuga que la sostiene; sin soporte
    //    (agua abierta o tortuga que acaba de sumergirse) se ahoga.
    if (!frog.animating && isRiverRow(frog.row)) {
      const lane = lanes.find((l) => l.row === frog.row);
      const support = getSupport();
      if (!support || !lane) {
        killFrog();
        return;
      }
      frog.col += ((lane.speed / CELL) * lane.dir * dtMs) / 16;
      // Salir por un lateral arrastrada por la corriente también es muerte.
      if (frog.col < 0 || frog.col > COLS - 1) {
        killFrog();
        return;
      }
    }

    // 4. Atropello: se comprueba cada frame porque los vehículos siguen moviéndose.
    if (isRoadRow(frog.row) && checkRoadCollision()) {
      killFrog();
      return;
    }

    // 5. Temporizador de ronda.
    timeLeft -= dtS;
    if (timeLeft <= 0) {
      timeLeft = 0;
      killFrog();
    }
  }

  // ── Dibujo ─────────────────────────────────────────────────────────────────
  // Reparto vertical de la fila 0: barra de tiempo (0–4), HUD interno (4–18) y
  // bocas destino (18–40).
  const TIME_BAR_H = 4;
  const HUD_H = 14;
  const GOAL_TOP = TIME_BAR_H + HUD_H;

  function drawZones() {
    // Río y carretera ocupan bloques completos de filas.
    ctx!.fillStyle = palette.rio;
    ctx!.fillRect(0, ROW_RIVER_TOP * CELL, CANVAS_W, (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL);
    ctx!.fillStyle = palette.carretera;
    ctx!.fillRect(0, ROW_ROAD_TOP * CELL, CANVAS_W, (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL);
    // Franjas seguras: la intermedia y la de inicio.
    ctx!.fillStyle = palette.seguro;
    ctx!.fillRect(0, ROW_SAFE_MID * CELL, CANVAS_W, CELL);
    ctx!.fillRect(0, ROW_START * CELL, CANVAS_W, CELL);
    // Líneas discontinuas entre carriles de carretera.
    ctx!.strokeStyle = palette.carril;
    ctx!.lineWidth = 2;
    ctx!.setLineDash([14, 12]);
    ctx!.beginPath();
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      ctx!.moveTo(0, r * CELL);
      ctx!.lineTo(CANVAS_W, r * CELL);
    }
    ctx!.stroke();
    ctx!.setLineDash([]);
  }

  function drawGoals() {
    ctx!.fillStyle = palette.metaFondo;
    ctx!.fillRect(0, 0, CANVAS_W, CELL);
    const h = CELL - GOAL_TOP - 3;
    for (let i = 0; i < GOAL_COUNT; i++) {
      const x = goalCol(i) * CELL;
      const w = GOAL_WIDTH * CELL;
      ctx!.fillStyle = palette.metaHueco;
      ctx!.beginPath();
      ctx!.roundRect(x + 3, GOAL_TOP, w - 6, h, 6);
      ctx!.fill();
      ctx!.strokeStyle = palette.metaBorde;
      ctx!.lineWidth = 2;
      ctx!.stroke();
      if (goals[i]) {
        // Boca ocupada: silueta de rana dentro.
        ctx!.fillStyle = palette.metaOcupada;
        ctx!.beginPath();
        ctx!.ellipse(x + w / 2, GOAL_TOP + h / 2, 11, 8, 0, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.beginPath();
        ctx!.arc(x + w / 2 - 5, GOAL_TOP + h / 2 - 6, 3, 0, Math.PI * 2);
        ctx!.arc(x + w / 2 + 5, GOAL_TOP + h / 2 - 6, 3, 0, Math.PI * 2);
        ctx!.fill();
      }
    }
  }

  function drawCar(x: number, y: number, w: number, tint: number) {
    const body = palette.coches[tint % palette.coches.length];
    ctx!.fillStyle = body;
    ctx!.beginPath();
    ctx!.roundRect(x + 3, y + 8, w - 6, CELL - 16, 5);
    ctx!.fill();
    // Parabrisas y ruedas.
    ctx!.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx!.fillRect(x + w / 2 - 4, y + 12, 8, CELL - 24);
    ctx!.fillStyle = palette.rueda;
    for (const cx of [x + 9, x + w - 9]) {
      ctx!.beginPath();
      ctx!.arc(cx, y + 8, 3.5, 0, Math.PI * 2);
      ctx!.arc(cx, y + CELL - 8, 3.5, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function drawTruck(x: number, y: number, w: number, dir: 1 | -1) {
    // Caja + cabina diferenciada en el frente (según el sentido del carril).
    ctx!.fillStyle = palette.camion;
    ctx!.beginPath();
    ctx!.roundRect(x + 3, y + 6, w - 6, CELL - 12, 3);
    ctx!.fill();
    ctx!.fillStyle = palette.camionCabina;
    const cabW = CELL * 0.7;
    const cabX = dir === 1 ? x + w - 3 - cabW : x + 3;
    ctx!.beginPath();
    ctx!.roundRect(cabX, y + 4, cabW, CELL - 8, 4);
    ctx!.fill();
    ctx!.fillStyle = palette.rueda;
    for (const cx of [x + 12, x + w / 2, x + w - 12]) {
      ctx!.beginPath();
      ctx!.arc(cx, y + 6, 3.5, 0, Math.PI * 2);
      ctx!.arc(cx, y + CELL - 6, 3.5, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function drawLog(x: number, y: number, w: number) {
    ctx!.fillStyle = palette.tronco;
    ctx!.beginPath();
    ctx!.roundRect(x, y + 6, w, CELL - 12, 9);
    ctx!.fill();
    // Vetas longitudinales.
    ctx!.strokeStyle = palette.troncoVeta;
    ctx!.lineWidth = 2;
    ctx!.beginPath();
    for (const off of [12, 20, 28]) {
      ctx!.moveTo(x + 6, y + off);
      ctx!.lineTo(x + w - 6, y + off);
    }
    ctx!.stroke();
  }

  function drawTurtles(x: number, y: number, w: number, submerged: boolean) {
    const count = Math.round(w / CELL);
    for (let i = 0; i < count; i++) {
      const cx = x + i * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (submerged) {
        ctx!.strokeStyle = palette.tortugaSumergida;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(cx, cy, CELL / 2 - 6, 0, Math.PI * 2);
        ctx!.stroke();
        continue;
      }
      ctx!.fillStyle = palette.tortuga;
      ctx!.beginPath();
      ctx!.arc(cx, cy, CELL / 2 - 4, 0, Math.PI * 2);
      ctx!.fill();
      // Escamas del caparazón.
      ctx!.strokeStyle = palette.tortugaEscama;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.arc(cx, cy, CELL / 2 - 9, 0, Math.PI * 2);
      ctx!.moveTo(cx - 7, cy);
      ctx!.lineTo(cx + 7, cy);
      ctx!.moveTo(cx, cy - 7);
      ctx!.lineTo(cx, cy + 7);
      ctx!.stroke();
    }
  }

  function drawLanes() {
    for (const lane of lanes) {
      const y = lane.row * CELL;
      for (const e of lane.entities) {
        const x = e.col * CELL;
        const w = e.width * CELL;
        if (e.type === "car") drawCar(x, y, w, e.tint ?? 0);
        else if (e.type === "truck") drawTruck(x, y, w, lane.dir);
        else if (e.type === "log") drawLog(x, y, w);
        else drawTurtles(x, y, w, e.submerged === true);
      }
    }
  }

  function drawFrog() {
    // Interpolación del salto: de (col,row) a (targetCol,targetRow) en HOP_MS.
    const t = frog.animating ? clamp(frog.animT / HOP_MS, 0, 1) : 0;
    const col = frog.animating ? frog.col + (frog.targetCol - frog.col) * t : frog.col;
    const row = frog.animating ? frog.row + (frog.targetRow - frog.row) * t : frog.row;
    const cx = col * CELL + CELL / 2;
    const cy = row * CELL + CELL / 2;
    // Durante el salto la rana se estira y las patas se extienden.
    const stretch = frog.animating ? 1 + Math.sin(t * Math.PI) * 0.25 : 1;

    ctx!.fillStyle = palette.ranaPata;
    for (const [dx, dy] of [
      [-11, -9],
      [11, -9],
      [-11, 9],
      [11, 9],
    ]) {
      ctx!.beginPath();
      ctx!.ellipse(cx + dx * stretch, cy + dy * stretch, 5, 3.5, 0, 0, Math.PI * 2);
      ctx!.fill();
    }
    ctx!.fillStyle = palette.rana;
    ctx!.beginPath();
    ctx!.ellipse(cx, cy, 14 * stretch, 12 / stretch, 0, 0, Math.PI * 2);
    ctx!.fill();
    // Ojos.
    ctx!.fillStyle = palette.ranaOjo;
    ctx!.beginPath();
    ctx!.arc(cx - 5, cy - 5, 3.5, 0, Math.PI * 2);
    ctx!.arc(cx + 5, cy - 5, 3.5, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.fillStyle = palette.ranaPata;
    ctx!.beginPath();
    ctx!.arc(cx - 5, cy - 5, 1.6, 0, Math.PI * 2);
    ctx!.arc(cx + 5, cy - 5, 1.6, 0, Math.PI * 2);
    ctx!.fill();
  }

  function drawHud() {
    // Barra de tiempo a lo ancho de la fila 0 (verde → amarillo → rojo).
    const ratio = clamp(timeLeft / roundTime(level), 0, 1);
    ctx!.fillStyle =
      ratio > 0.5 ? palette.tiempoAlto : ratio > 0.2 ? palette.tiempoMedio : palette.tiempoBajo;
    ctx!.fillRect(0, 0, CANVAS_W * ratio, TIME_BAR_H);
    // Score, nivel y vidas.
    ctx!.fillStyle = palette.hudTexto;
    ctx!.font = "12px monospace";
    ctx!.textBaseline = "middle";
    const midY = TIME_BAR_H + HUD_H / 2;
    ctx!.textAlign = "left";
    ctx!.fillText(`SCORE ${score}`, 6, midY);
    ctx!.textAlign = "center";
    ctx!.fillText(`NIVEL ${level}`, CANVAS_W / 2, midY);
    // Vidas: un círculo verde por vida restante, alineados a la derecha.
    ctx!.fillStyle = palette.rana;
    for (let i = 0; i < lives; i++) {
      ctx!.beginPath();
      ctx!.arc(CANVAS_W - 10 - i * 14, midY, 4.5, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function draw() {
    ctx!.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawZones();
    drawLanes();
    drawGoals();
    drawHud();
    drawFrog();
  }

  // ── Loop principal ─────────────────────────────────────────────────────────
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;

  function loop(ts: number) {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);
    // dt acotado a 50 ms para que un cambio de pestaña no teletransporte nada.
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    if (!paused) {
      update(dtMs);
      emitChanges();
    }
    // `paused` congela update() pero el canvas se sigue dibujando.
    draw();
  }

  // ── Arranque ───────────────────────────────────────────────────────────────
  window.addEventListener("keydown", onKeyDown);
  initGame();
  emitChanges(); // estado inicial (0 / 3 / 1)
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
    setPaused(p: boolean) {
      paused = p;
      // Al reanudar se resetea el reloj para no acumular el tiempo en pausa.
      if (!p) lastTime = null;
    },
    restart() {
      initGame();
      emitChanges();
      paused = false;
      lastTime = null;
    },
    setSkin(skin: SkinId) {
      palette = FROGGER_SKINS[skin];
    },
  };
}
