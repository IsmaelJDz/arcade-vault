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
