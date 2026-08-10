// Motor del juego Serpentina (Snake) — construido desde cero (no hay fuente en
// references/started-games/; solo el spritesheet de frutas). Sigue el mismo
// contrato y patrón que lib/games/asteroids.ts: todo el estado vive dentro de
// initSerpentina(), nada toca el DOM al importar, y la UI (HUD, pausa, modal de
// fin) la pone React. Es el primer motor del repo que usa drawImage.

import { frameEnd, frameStart } from "./perf";
import type { SkinId } from "./skins";

export interface SerpentinaHandlers {
  onScore: (score: number) => void;
  onLength: (length: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface SerpentinaControls {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  setSkin: (skin: SkinId) => void;
}

// ── Paleta por skin (solo colores del canvas; el chrome queda fuera) ─────────
// Las frutas se dibujan con sprites PNG (drawImage) y quedan exentas del skin;
// solo el círculo placeholder (mientras carga el spritesheet) usa la paleta.
export interface SerpentinaPalette {
  fondo: string; // fondo del canvas
  grid: string; // líneas de la cuadrícula (con alpha, decoración secundaria)
  cabeza: string; // primer segmento de la serpiente
  cuerpo: string; // resto de segmentos
  glowCabeza: string; // shadowColor de la cabeza (derivado de su color)
  glowCuerpo: string; // shadowColor del cuerpo (derivado de su color)
  blurCabeza: number; // shadowBlur de la cabeza en px
  blurCuerpo: number; // shadowBlur del cuerpo en px
  fruta: string; // círculo placeholder mientras carga el spritesheet
}

export const SERPENTINA_SKINS: Record<SkinId, SerpentinaPalette> = {
  // Paleta original del motor, movida tal cual (regresión visual cero).
  clasico: {
    fondo: "#050810",
    grid: "rgba(0, 255, 136, 0.05)",
    cabeza: "#7dffb8",
    cuerpo: "#00ff88",
    glowCabeza: "rgba(0, 255, 136, 0.8)",
    glowCuerpo: "rgba(0, 255, 136, 0.8)",
    blurCabeza: 14,
    blurCuerpo: 8,
    fruta: "#ff2bd6",
  },
  // Synthwave saturado: cuerpo cian y cabeza magenta con glow intenso sobre violeta.
  neon: {
    fondo: "#0b0217",
    grid: "rgba(0, 240, 255, 0.07)",
    cabeza: "#ff2fd6",
    cuerpo: "#00f0ff",
    glowCabeza: "rgba(255, 47, 214, 0.9)",
    glowCuerpo: "rgba(0, 240, 255, 0.9)",
    blurCabeza: 18,
    blurCuerpo: 12,
    fruta: "#f5ff00",
  },
  // CRT de época: cuerpo en fósforo ámbar y cabeza en fósforo verde (tonos distintos).
  retro: {
    fondo: "#0c0a04",
    grid: "rgba(255, 176, 0, 0.05)",
    cabeza: "#33ff33",
    cuerpo: "#ffb000",
    glowCabeza: "rgba(51, 255, 51, 0.6)",
    glowCuerpo: "rgba(255, 176, 0, 0.6)",
    blurCabeza: 6,
    blurCuerpo: 4,
    fruta: "#ff6a3d",
  },
};

// ── Dimensiones fijas (el escalado es solo CSS) ──────────────────────────────
const W = 800;
const H = 600;
const CELL = 20;
const COLS = W / CELL; // 40
const ROWS = H / CELL; // 30

// ── Reglas de juego ──────────────────────────────────────────────────────────
const POINTS_PER_FRUIT = 10;
const FRUITS_PER_LEVEL = 5;
const BASE_TICK = 0.13; // segundos por paso al nivel 1
const MIN_TICK = 0.06; // tope de velocidad
const TICK_STEP = 0.009; // cuánto acelera por nivel

// ── Atlas de frutas (coordenadas de snake-assets/sprites.js, inline) ─────────
// Recortes { x, y, w, h } dentro de /games/serpentina/fruits.png (3790×442).
const FRUIT_ATLAS: Record<string, { x: number; y: number; w: number; h: number }> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};
const FRUIT_KEYS = Object.keys(FRUIT_ATLAS);

// ── Utils puras ──────────────────────────────────────────────────────────────
const randInt = (max: number) => Math.floor(Math.random() * max);

type Cell = { x: number; y: number };
type GameState = "playing" | "gameover";

export function initSerpentina(
  canvas: HTMLCanvasElement,
  handlers: SerpentinaHandlers,
  options?: { skin?: SkinId },
): SerpentinaControls {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // Paleta activa: mutable para que setSkin() cambie los colores en vivo,
  // sin reiniciar la partida (el draw-loop la lee cada frame).
  let palette: SerpentinaPalette = SERPENTINA_SKINS[options?.skin ?? "clasico"];

  // ── Spritesheet de frutas ──────────────────────────────────────────────────
  let sprites: HTMLImageElement | null = new Image();
  let spritesReady = false;
  sprites.onload = () => {
    spritesReady = true;
  };
  sprites.src = "/games/serpentina/fruits.png";

  // ── Input (por instancia) ──────────────────────────────────────────────────
  const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (state !== "playing") return;
    // Se compara contra `dir` (la dirección ya confirmada este tick) para
    // impedir el giro de 180°, incluso con dos pulsaciones dentro de un tick.
    if (e.code === "ArrowUp" && dir.y !== 1) nextDir = { x: 0, y: -1 };
    else if (e.code === "ArrowDown" && dir.y !== -1) nextDir = { x: 0, y: 1 };
    else if (e.code === "ArrowLeft" && dir.x !== 1) nextDir = { x: -1, y: 0 };
    else if (e.code === "ArrowRight" && dir.x !== -1) nextDir = { x: 1, y: 0 };
  };

  // ── Estado del juego (por instancia) ───────────────────────────────────────
  let snake: Cell[];
  let dir: Cell;
  let nextDir: Cell;
  let food: { x: number; y: number; key: string };
  let score: number;
  let fruitsEaten: number;
  let level: number;
  let state: GameState;
  let acc = 0; // acumulador de tiempo entre pasos

  // Últimos valores emitidos (para disparar callbacks solo en cambios).
  let lastScore = -1;
  let lastLength = -1;
  let lastLevel = -1;
  let gameOverEmitted = false;

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      handlers.onScore(score);
    }
    if (snake.length !== lastLength) {
      lastLength = snake.length;
      handlers.onLength(snake.length);
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

  function tickInterval(): number {
    return Math.max(MIN_TICK, BASE_TICK - (level - 1) * TICK_STEP);
  }

  function spawnFood() {
    // Elige una celda libre (no ocupada por la serpiente).
    let x: number, y: number;
    do {
      x = randInt(COLS);
      y = randInt(ROWS);
    } while (snake.some((s) => s.x === x && s.y === y));
    food = { x, y, key: FRUIT_KEYS[randInt(FRUIT_KEYS.length)] };
  }

  function initGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    snake = [
      { x: cx, y: cy },
      { x: cx - 1, y: cy },
      { x: cx - 2, y: cy },
    ];
    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };
    score = 0;
    fruitsEaten = 0;
    level = 1;
    state = "playing";
    acc = 0;
    gameOverEmitted = false;
    spawnFood();
  }

  // ── Paso lógico (un movimiento de la serpiente) ─────────────────────────────
  function step() {
    dir = nextDir;
    const head = snake[0];
    const newHead: Cell = { x: head.x + dir.x, y: head.y + dir.y };

    // Choque contra la pared → fin.
    if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
      state = "gameover";
      return;
    }

    const willGrow = newHead.x === food.x && newHead.y === food.y;

    // Choque contra la cola. Si no crece, la última celda se libera este paso.
    const body = willGrow ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      state = "gameover";
      return;
    }

    snake.unshift(newHead);
    if (willGrow) {
      score += POINTS_PER_FRUIT;
      fruitsEaten++;
      level = 1 + Math.floor(fruitsEaten / FRUITS_PER_LEVEL);
      spawnFood();
    } else {
      snake.pop();
    }
  }

  // ── Dibujo (solo el área de juego; sin HUD ni overlay GAME OVER) ────────────
  function drawGrid() {
    ctx!.strokeStyle = palette.grid;
    ctx!.lineWidth = 1;
    ctx!.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx!.moveTo(c * CELL, 0);
      ctx!.lineTo(c * CELL, H);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx!.moveTo(0, r * CELL);
      ctx!.lineTo(W, r * CELL);
    }
    ctx!.stroke();
  }

  function drawFood() {
    const dx = food.x * CELL;
    const dy = food.y * CELL;
    if (spritesReady && sprites) {
      const f = FRUIT_ATLAS[food.key];
      const maxSize = CELL - 2;
      const scale = Math.min(maxSize / f.w, maxSize / f.h);
      const dw = f.w * scale;
      const dh = f.h * scale;
      ctx!.drawImage(
        sprites,
        f.x,
        f.y,
        f.w,
        f.h,
        dx + (CELL - dw) / 2,
        dy + (CELL - dh) / 2,
        dw,
        dh,
      );
    } else {
      // Placeholder mientras el spritesheet carga.
      ctx!.fillStyle = palette.fruta;
      ctx!.beginPath();
      ctx!.arc(dx + CELL / 2, dy + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function drawSnake() {
    for (let i = 0; i < snake.length; i++) {
      const s = snake[i];
      const px = s.x * CELL;
      const py = s.y * CELL;
      ctx!.shadowColor = i === 0 ? palette.glowCabeza : palette.glowCuerpo;
      ctx!.shadowBlur = i === 0 ? palette.blurCabeza : palette.blurCuerpo;
      ctx!.fillStyle = i === 0 ? palette.cabeza : palette.cuerpo;
      ctx!.beginPath();
      ctx!.roundRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3, 5);
      ctx!.fill();
    }
    ctx!.shadowBlur = 0;
  }

  function draw() {
    ctx!.fillStyle = palette.fondo;
    ctx!.fillRect(0, 0, W, H);
    drawGrid();
    drawFood();
    drawSnake();
  }

  // ── Loop principal ─────────────────────────────────────────────────────────
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;

  function loop(ts: number) {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);
    frameStart();
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) {
      acc += dt;
      // Avanza en pasos fijos; la velocidad depende del nivel, no del refresco.
      while (state === "playing" && acc >= tickInterval()) {
        acc -= tickInterval();
        step();
      }
      emitChanges();
    }
    draw();
    frameEnd();
  }

  // ── Arranque ───────────────────────────────────────────────────────────────
  window.addEventListener("keydown", onKeyDown);
  initGame();
  emitChanges(); // emite el estado inicial (0 / 3 / 1)
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      if (sprites) sprites.onload = null;
      sprites = null;
    },
    setPaused(p: boolean) {
      paused = p;
      if (!p) {
        // Al reanudar, resetea el reloj para no acumular tiempo (evita el salto).
        lastTime = null;
      }
    },
    restart() {
      initGame();
      emitChanges();
      paused = false;
      lastTime = null;
    },
    setSkin(skin: SkinId) {
      // Cambio de paleta en vivo: no toca el estado de la partida.
      palette = SERPENTINA_SKINS[skin];
    },
  };
}
