// Motor del juego Arkanoid ("bloque-buster") — port de
// references/started-games/04-arkanoid/game.js + levels.js a un módulo TS sin
// globals ni acceso al DOM al importar. Todo el estado vive dentro de
// initBloqueBuster(); la UI (HUD, pausa, modal de fin) la pone React. Los sprites
// del PNG original se redibujan en estilo vector-neón; se conservan los 2 sonidos.

import { frameEnd, frameStart } from "./perf";
import type { SkinId } from "./skins";

export interface BloqueBusterHandlers {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface BloqueBusterControls {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  setSkin: (skin: SkinId) => void;
}

// ── Dimensiones fijas (el escalado es solo CSS) ──────────────────────────────
const W = 800;
const H = 600;

// ── Constantes de juego (idénticas al original) ──────────────────────────────
const PADDLE_SPEED = 400;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const EXPLOSION_DURATION = 150; // ms

// ── Paleta por skin (solo colores del canvas; el chrome queda fuera) ─────────
export interface BloqueBusterPalette {
  fondo: string; // fondo del canvas
  bloques: Record<string, string>; // color por clave de bloque de los niveles
  brillo: string; // brillo interior de los bloques (se pinta con alpha 0.25)
  paleta: string; // paddle
  bola: string; // pelota
  glow: number; // factor sobre los shadowBlur base (1 = look original)
}

export const BLOQUE_BUSTER_SKINS: Record<SkinId, BloqueBusterPalette> = {
  // Paleta vector-neón original del port (reemplazó el spritesheet), movida
  // tal cual: regresión visual cero.
  clasico: {
    fondo: "#000",
    bloques: {
      red: "#ff3b5c",
      yellow: "#ffe94d",
      cyan: "#4dfff5",
      magenta: "#ff4dff",
      hotpink: "#ff6ec7",
      green: "#4dff88",
      gray: "#9aa0aa",
    },
    brillo: "#ffffff",
    paleta: "#4dfff5",
    bola: "#ffffff",
    glow: 1,
  },
  // Synthwave saturado: primarios eléctricos con glow reforzado sobre violeta oscuro.
  neon: {
    fondo: "#0b0217",
    bloques: {
      red: "#ff3355",
      yellow: "#faff00",
      cyan: "#00f0ff",
      magenta: "#ff2fd6",
      hotpink: "#ff7ab8",
      green: "#39ff14",
      gray: "#8f9dff",
    },
    brillo: "#ffffff",
    paleta: "#00f0ff",
    bola: "#faff00",
    glow: 1.5,
  },
  // CRT de 8 bits apagado: tonos de época sobre ámbar-negro, con bloom sutil.
  retro: {
    fondo: "#140d02",
    bloques: {
      red: "#e0563c",
      yellow: "#ffb000",
      cyan: "#6fc7b4",
      magenta: "#c77bd4",
      hotpink: "#e08a9e",
      green: "#8fbf4f",
      gray: "#b0a890",
    },
    brillo: "#fff3d0",
    paleta: "#ffb000",
    bola: "#ffe9b0",
    glow: 0.35,
  },
};

// ── Niveles (port literal de levels.js) ──────────────────────────────────────
interface BlockDef {
  col: number;
  row: number;
  color: string;
}
interface Level {
  speed: number;
  blocks: BlockDef[];
}

function buildLevels(): Level[] {
  const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
  const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
  const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

  const l1: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) l1.push({ col, row, color: rowColors1[row] });

  const l2: BlockDef[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0) l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col)) l4.push({ col, row, color: rowColors4[row] });

  const l5: BlockDef[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
}

type GameState = "playing" | "gameover" | "win";

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}
interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  elapsed: number;
}

export function initBloqueBuster(
  canvas: HTMLCanvasElement,
  handlers: BloqueBusterHandlers,
  options?: { skin?: SkinId },
): BloqueBusterControls {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // Paleta activa: mutable para que setSkin() cambie los colores en vivo,
  // sin reiniciar la partida (el draw-loop la lee cada frame).
  let palette: BloqueBusterPalette = BLOQUE_BUSTER_SKINS[options?.skin ?? "clasico"];

  const LEVELS = buildLevels();

  // ── Sonido (solapable vía cloneNode, como el original) ─────────────────────
  let bounceSound: HTMLAudioElement | null = new Audio("/games/bloque-buster/ball-bounce.mp3");
  let breakSound: HTMLAudioElement | null = new Audio("/games/bloque-buster/break-sound.mp3");
  const playSound = (snd: HTMLAudioElement | null) => {
    if (!snd) return;
    const clone = snd.cloneNode() as HTMLAudioElement;
    void clone.play().catch(() => {}); // ignora bloqueos de autoplay
  };

  // ── Input (por instancia) ──────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault();
      keys[e.code] = true;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault();
      keys[e.code] = false;
    }
  };

  // ── Estado del juego (por instancia) ───────────────────────────────────────
  const paddle = { x: 0, y: 560, w: 81, h: 14 };
  const ball = { x: 0, y: 0, w: 16, h: 16, vx: 200, vy: -300 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let lives = 3;
  let score = 0;
  let currentLevel = 1;
  let gameState: GameState = "playing";

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
    if (currentLevel !== lastLevel) {
      lastLevel = currentLevel;
      handlers.onLevel(currentLevel);
    }
    // Victoria (nivel 5 limpio) y derrota (vidas a 0) terminan igual: modal de FIN.
    if ((gameState === "gameover" || gameState === "win") && !gameOverEmitted) {
      gameOverEmitted = true;
      handlers.onGameOver(score);
    }
  }

  function initPaddle() {
    paddle.x = (W - paddle.w) / 2;
  }

  function initBall() {
    const speed = LEVELS[currentLevel - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    currentLevel = n;
    const level = LEVELS[n - 1];
    blocks = level.blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  }

  function collideAABB(block: Block) {
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  function initGame() {
    lives = 3;
    score = 0;
    gameState = "playing";
    gameOverEmitted = false;
    initPaddle();
    loadLevel(1);
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (gameState !== "playing") return;

    // Paddle
    if (keys["ArrowLeft"]) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (keys["ArrowRight"]) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Ball movement
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Wall bounces (left, right, top)
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Paddle bounce
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Block collisions (uno por frame)
    for (const block of blocks) {
      if (!block.alive) continue;
      if (collideAABB(block)) {
        block.alive = false;
        explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        score += 10;
        ball.vy = -ball.vy;
        playSound(breakSound);
        if (blocks.every((b) => !b.alive)) {
          if (currentLevel < 5) loadLevel(currentLevel + 1);
          else gameState = "win";
        }
        break;
      }
    }

    // Explosiones
    for (const exp of explosions) exp.elapsed += dt * 1000;
    explosions = explosions.filter((exp) => exp.elapsed < EXPLOSION_DURATION);

    // Pelota perdida
    if (ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        gameState = "gameover";
      } else {
        initBall();
      }
    }
  }

  // ── Draw (solo área de juego, vector-neón; sin HUD ni overlay) ─────────────
  function roundRect(x: number, y: number, w: number, h: number, r: number) {
    ctx!.beginPath();
    ctx!.roundRect(x, y, w, h, r);
  }

  function drawBlock(b: Block) {
    const color = palette.bloques[b.color] ?? "#ffffff";
    ctx!.save();
    ctx!.shadowColor = color;
    ctx!.shadowBlur = 12 * palette.glow;
    ctx!.fillStyle = color;
    roundRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4, 4);
    ctx!.fill();
    // Brillo interior sutil
    ctx!.shadowBlur = 0;
    ctx!.globalAlpha = 0.25;
    ctx!.fillStyle = palette.brillo;
    roundRect(b.x + 4, b.y + 4, b.w - 8, (b.h - 8) / 2, 3);
    ctx!.fill();
    ctx!.restore();
  }

  function drawExplosion(exp: Explosion) {
    const t = exp.elapsed / EXPLOSION_DURATION; // 0 → 1
    const alpha = 1 - t;
    const grow = 1 + t * 0.8;
    const color = palette.bloques[exp.color] ?? "#ffffff";
    const cx = exp.x + exp.w / 2;
    const cy = exp.y + exp.h / 2;
    const w = exp.w * grow;
    const h = exp.h * grow;
    ctx!.save();
    ctx!.globalAlpha = alpha;
    ctx!.shadowColor = color;
    ctx!.shadowBlur = 20 * palette.glow;
    ctx!.strokeStyle = color;
    ctx!.lineWidth = 2;
    roundRect(cx - w / 2, cy - h / 2, w, h, 4);
    ctx!.stroke();
    ctx!.restore();
  }

  function drawPaddle() {
    ctx!.save();
    ctx!.shadowColor = palette.paleta;
    ctx!.shadowBlur = 14 * palette.glow;
    ctx!.fillStyle = palette.paleta;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
    ctx!.fill();
    ctx!.restore();
  }

  function drawBall() {
    const cx = ball.x + ball.w / 2;
    const cy = ball.y + ball.h / 2;
    ctx!.save();
    ctx!.shadowColor = palette.bola;
    ctx!.shadowBlur = 16 * palette.glow;
    ctx!.fillStyle = palette.bola;
    ctx!.beginPath();
    ctx!.arc(cx, cy, ball.w / 2, 0, Math.PI * 2);
    ctx!.fill();
    ctx!.restore();
  }

  function draw() {
    ctx!.fillStyle = palette.fondo;
    ctx!.fillRect(0, 0, W, H);

    for (const block of blocks) if (block.alive) drawBlock(block);
    for (const exp of explosions) drawExplosion(exp);
    drawPaddle();
    drawBall();
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
      update(dt);
      emitChanges();
    }
    draw();
    frameEnd();
  }

  // ── Arranque ───────────────────────────────────────────────────────────────
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  initGame();
  emitChanges(); // emite el estado inicial (0 / 3 / 1)
  rafId = requestAnimationFrame(loop);

  return {
    destroy() {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      bounceSound = null;
      breakSound = null;
    },
    setPaused(p: boolean) {
      paused = p;
      if (p) {
        // Descarta el input en buffer para no moverse al reanudar.
        for (const k in keys) keys[k] = false;
      } else {
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
      palette = BLOQUE_BUSTER_SKINS[skin];
    },
  };
}
