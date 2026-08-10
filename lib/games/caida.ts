// Motor del juego Caída (Tetris) — port de references/started-games/03-tetris/game.js
// a un módulo TS sin globals ni acceso al DOM al importar. Todo el estado vive
// dentro de initCaida(); la UI (HUD, pausa, modal de fin, preview de la próxima
// pieza) la pone React. El motor dibuja solo el tablero en el canvas principal.

import { frameEnd, frameStart } from "./perf";
import type { SkinId } from "./skins";

export interface NextPiece {
  type: number; // 1..8 (índice de color/pieza; 8 = tuerca N)
  shape: number[][]; // matriz de la próxima pieza
}

export interface CaidaHandlers {
  onScore: (score: number) => void; // score acumulado
  onLines: (lines: number) => void; // líneas totales limpiadas
  onLevel: (level: number) => void; // floor(lines/10)+1
  onNext: (piece: NextPiece) => void; // próxima pieza (para el preview React)
  onGameOver: (finalScore: number) => void; // al colisionar el spawn
}

export interface CaidaControls {
  destroy: () => void; // detiene el loop y quita listeners
  setPaused: (paused: boolean) => void; // congela update; sigue dibujando
  restart: () => void; // reinicia la partida (init)
  setSkin: (skin: SkinId) => void; // cambia la paleta en vivo (sin reiniciar)
}

// ── Dimensiones fijas (el escalado es solo CSS) ──────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const W = COLS * BLOCK; // 300
const H = ROWS * BLOCK; // 600

// ── Paleta por skin (solo colores del canvas; el chrome queda fuera) ─────────
export interface CaidaPalette {
  fondo: string; // fondo del tablero
  grid: string; // líneas de la cuadrícula (decoración, no debe competir)
  brillo: string; // highlight superior de cada bloque
  piezas: (string | null)[]; // indexada 1..8 (el 0 no se dibuja)
}

export const CAIDA_SKINS: Record<SkinId, CaidaPalette> = {
  // Paleta original del port: pasteles Material sobre negro puro.
  clasico: {
    fondo: "#000000",
    grid: "rgba(120, 180, 200, 0.10)",
    brillo: "rgba(255, 255, 255, 0.12)",
    piezas: [
      null,
      "#4dd0e1", // I - cyan
      "#ffd54f", // O - yellow
      "#ba68c8", // T - purple
      "#81c784", // S - green
      "#e57373", // Z - red
      "#90caf9", // J - pale blue
      "#ffb74d", // L - orange
      "#9e9e9e", // N - tuerca (gris metálico)
    ],
  },
  // Synthwave: siete tonos saturados bien separados sobre violeta profundo.
  neon: {
    fondo: "#0b0217",
    grid: "rgba(0, 240, 255, 0.12)",
    brillo: "rgba(255, 255, 255, 0.22)",
    piezas: [
      null,
      "#00f0ff", // I - cian eléctrico
      "#f5ff00", // O - amarillo ácido
      "#c14dff", // T - violeta
      "#39ff88", // S - verde neón
      "#ff2d6f", // Z - rosa
      "#3d7bff", // J - azul eléctrico
      "#ff9e2d", // L - ámbar
      "#c9c9d6", // N - tuerca (metal, sin saturación)
    ],
  },
  // CRT de época: tonos de 8 bits apagados sobre negro cálido.
  retro: {
    fondo: "#0d0b06",
    grid: "rgba(255, 176, 0, 0.10)",
    brillo: "rgba(255, 240, 200, 0.12)",
    piezas: [
      null,
      "#4fb3a5", // I - turquesa apagado
      "#d9c84a", // O - amarillo mostaza
      "#a86bb5", // T - púrpura polvoriento
      "#6fae44", // S - verde oliva
      "#cf4f4f", // Z - rojo ladrillo
      "#5a7fc2", // J - azul acero
      "#d1863f", // L - naranja quemado
      "#a89f8c", // N - tuerca (gris cálido)
    ],
  },
};

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

// ── Draw helpers puros (compartidos por el tablero y el preview) ──────────────
function drawBlock(
  context: CanvasRenderingContext2D,
  palette: CaidaPalette,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
) {
  if (!colorIndex) return;
  const color = palette.piezas[colorIndex];
  if (!color) return;
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight superior
  context.fillStyle = palette.brillo;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

// Dibuja la próxima pieza centrada en un canvas de preview. Pura: la usa el
// wrapper React (no reimplementa la paleta ni el estilo de bloque). El preview
// es canvas de juego, así que también sigue la skin activa.
export function drawNextPreview(
  canvas: HTMLCanvasElement,
  piece: NextPiece | null,
  skin: SkinId = "clasico",
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const palette = CAIDA_SKINS[skin];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!piece) return;
  const shape = piece.shape;
  const nb = Math.floor(Math.min(canvas.width, canvas.height) / 4);
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  const padX = (canvas.width - 4 * nb) / 2;
  const padY = (canvas.height - 4 * nb) / 2;
  ctx.save();
  ctx.translate(padX, padY);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(ctx, palette, offX + c, offY + r, shape[r][c], nb);
  ctx.restore();
}

export function initCaida(
  canvas: HTMLCanvasElement,
  handlers: CaidaHandlers,
  options?: { skin?: SkinId },
): CaidaControls {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // Paleta activa: mutable para que setSkin() cambie los colores en vivo.
  let palette: CaidaPalette = CAIDA_SKINS[options?.skin ?? "clasico"];

  // ── Estado (por instancia) ─────────────────────────────────────────────────
  let board: number[][] = [];
  let current: Piece;
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let dropInterval = 1000;
  let dropAccum = 0;
  let gameOver = false;

  // Detección de cambios para los callbacks (no se disparan cada frame).
  let lastScore = -1;
  let lastLines = -1;
  let lastLevel = -1;
  let gameOverEmitted = false;

  // ── Lógica del juego ───────────────────────────────────────────────────────
  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result: number[][] = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c]) board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    handlers.onNext({ type: next.type, shape: next.shape });
    if (collide(current.shape, current.x, current.y)) {
      gameOver = true;
    }
  }

  // ── Dibujo (solo el tablero) ───────────────────────────────────────────────
  function drawGrid() {
    ctx!.strokeStyle = palette.grid;
    ctx!.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx!.beginPath();
      ctx!.moveTo(c * BLOCK, 0);
      ctx!.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx!.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx!.beginPath();
      ctx!.moveTo(0, r * BLOCK);
      ctx!.lineTo(COLS * BLOCK, r * BLOCK);
      ctx!.stroke();
    }
  }

  function draw() {
    ctx!.clearRect(0, 0, W, H);
    // Fondo propio de la skin (en `clasico` es el mismo negro que ya ponía el CSS).
    ctx!.fillStyle = palette.fondo;
    ctx!.fillRect(0, 0, W, H);
    drawGrid();

    // tablero
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(ctx!, palette, c, r, board[r][c], BLOCK);

    // pieza fantasma (ghost)
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(ctx!, palette, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // pieza actual
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        drawBlock(ctx!, palette, current.x + c, current.y + r, current.shape[r][c], BLOCK);
  }

  function emitChanges() {
    if (score !== lastScore) {
      lastScore = score;
      handlers.onScore(score);
    }
    if (lines !== lastLines) {
      lastLines = lines;
      handlers.onLines(lines);
    }
    if (level !== lastLevel) {
      lastLevel = level;
      handlers.onLevel(level);
    }
    if (gameOver && !gameOverEmitted) {
      gameOverEmitted = true;
      handlers.onGameOver(score);
    }
  }

  // ── Input (por instancia) ──────────────────────────────────────────────────
  const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "Space"]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (paused || gameOver) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
    emitChanges();
  };

  // ── Init / reset ───────────────────────────────────────────────────────────
  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    gameOver = false;
    gameOverEmitted = false;
    lastScore = -1;
    lastLines = -1;
    lastLevel = -1;
    next = randomPiece();
    spawn();
    emitChanges();
  }

  // ── Loop principal ─────────────────────────────────────────────────────────
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;

  function update(dtMs: number) {
    if (gameOver) return;
    dropAccum += dtMs;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }

  function loop(ts: number) {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);
    frameStart();
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, 100);
    lastTime = ts;
    if (!paused) {
      update(dtMs);
      emitChanges();
    }
    draw();
    frameEnd();
  }

  // ── Arranque ───────────────────────────────────────────────────────────────
  window.addEventListener("keydown", onKeyDown);
  init();
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
    setPaused(p: boolean) {
      paused = p;
      // Al reanudar, resetea el reloj para no acumular tiempo (evita el salto).
      if (!p) lastTime = null;
    },
    restart() {
      init();
      paused = false;
      lastTime = null;
    },
    setSkin(skin: SkinId) {
      palette = CAIDA_SKINS[skin];
    },
  };
}
