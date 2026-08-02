// Motor del juego Asteroids — port de references/started-games/02-asteroids/game.js
// a un módulo TS sin globals ni acceso al DOM al importar. Todo el estado vive
// dentro de initAsteroids(); la UI (HUD, pausa, modal de fin) la pone React.

import type { SkinId } from "./skins";

export interface AsteroidsHandlers {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface AsteroidsControls {
  destroy: () => void;
  setPaused: (paused: boolean) => void;
  restart: () => void;
  setSkin: (skin: SkinId) => void;
}

// ── Paleta por skin (solo colores del canvas; el chrome queda fuera) ─────────
export interface AsteroidsPalette {
  fondo: string; // fondo del canvas
  nave: string; // contorno de la nave
  propulsor: string; // llama del propulsor (con alpha)
  bala: string; // proyectiles
  asteroide: string; // contorno de las rocas
  particula: string; // base "r,g,b" de las chispas de explosión (alpha dinámico)
  powerup: string; // caja giratoria 3x y su texto
  indicador: string; // contador "3x N.Ns" dentro del canvas
  glow: number; // shadowBlur en px (0 = sin glow); el shadowColor deriva del elemento
}

export const ASTEROIDS_SKINS: Record<SkinId, AsteroidsPalette> = {
  // Paleta original del port, movida tal cual (regresión visual cero).
  clasico: {
    fondo: "#000",
    nave: "#fff",
    propulsor: "rgba(255, 130, 0, 0.85)",
    bala: "#fff",
    asteroide: "#fff",
    particula: "255,255,255",
    powerup: "#0ff",
    indicador: "#0ff",
    glow: 0,
  },
  // Synthwave saturado: cian/magenta/amarillo con glow intenso sobre violeta oscuro.
  neon: {
    fondo: "#0b0217",
    nave: "#00f0ff",
    propulsor: "rgba(255, 158, 0, 0.9)",
    bala: "#f5ff00",
    asteroide: "#ff2fd6",
    particula: "255,47,214",
    powerup: "#39ff14",
    indicador: "#39ff14",
    glow: 12,
  },
  // Fósforo verde de terminal CRT; el powerup en ámbar para distinguirlo por tono.
  retro: {
    fondo: "#041106",
    nave: "#33ff33",
    propulsor: "rgba(255, 176, 0, 0.85)",
    bala: "#b8ffc4",
    asteroide: "#2fbf5f",
    particula: "160,255,180",
    powerup: "#ffb000",
    indicador: "#ffb000",
    glow: 4,
  },
};

// ── Dimensiones fijas (el escalado es solo CSS) ──────────────────────────────
const W = 800;
const H = 600;

// ── Utils puras ──────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// ── Constantes ───────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;

const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

type GameState = "playing" | "dead" | "gameover";

export function initAsteroids(
  canvas: HTMLCanvasElement,
  handlers: AsteroidsHandlers,
  options?: { skin?: SkinId },
): AsteroidsControls {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");

  // Paleta activa: mutable para que setSkin() cambie los colores en vivo,
  // sin reiniciar la partida (el draw-loop la lee cada frame).
   
  let palette: AsteroidsPalette = ASTEROIDS_SKINS[options?.skin ?? "clasico"];

  // Glow acotado al trazo de un elemento: shadowColor siempre derivado del color.
  function withGlow(color: string, drawFn: () => void) {
    ctx!.save();
    if (palette.glow > 0) {
      ctx!.shadowColor = color;
      ctx!.shadowBlur = palette.glow;
    }
    drawFn();
    ctx!.restore();
  }

  // ── Input (por instancia) ──────────────────────────────────────────────────
  const keys: Record<string, boolean> = {};
  const justPressed: Record<string, boolean> = {};
  const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "Space"]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    keys[e.code] = false;
  };

  function pressed(code: string): boolean {
    const val = justPressed[code];
    justPressed[code] = false;
    return !!val;
  }

  // ── Bullet ───────────────────────────────────────────────────────────────
  class Bullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
    radius: number;
    dead: boolean;

    constructor(x: number, y: number, angle: number) {
      this.x = x;
      this.y = y;
      const SPEED = 520;
      this.vx = Math.cos(angle) * SPEED;
      this.vy = Math.sin(angle) * SPEED;
      this.ttl = 1.1;
      this.radius = 2;
      this.dead = false;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      withGlow(palette.bala, () => {
        ctx!.fillStyle = palette.bala;
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx!.fill();
      });
    }
  }

  // ── Asteroid ─────────────────────────────────────────────────────────────
  class Asteroid {
    x: number;
    y: number;
    size: number;
    radius: number;
    dead: boolean;
    vx: number;
    vy: number;
    rotSpeed: number;
    rot: number;
    verts: [number, number][];

    constructor(x: number, y: number, size = 3) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.radius = RADII[size];
      this.dead = false;

      const angle = rand(0, Math.PI * 2);
      const speed = SPEEDS[size] + rand(-15, 15);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.rotSpeed = rand(-1.2, 1.2);
      this.rot = rand(0, Math.PI * 2);

      const n = randInt(8, 13);
      this.verts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const r = this.radius * rand(0.6, 1.0);
        this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.rot += this.rotSpeed * dt;
    }

    split(): Asteroid[] {
      if (this.size <= 1) return [];
      return [
        new Asteroid(this.x, this.y, this.size - 1),
        new Asteroid(this.x, this.y, this.size - 1),
      ];
    }

    draw() {
      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(this.rot);
      if (palette.glow > 0) {
        ctx!.shadowColor = palette.asteroide;
        ctx!.shadowBlur = palette.glow;
      }
      ctx!.strokeStyle = palette.asteroide;
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";
      ctx!.beginPath();
      ctx!.moveTo(this.verts[0][0], this.verts[0][1]);
      for (let i = 1; i < this.verts.length; i++) ctx!.lineTo(this.verts[i][0], this.verts[i][1]);
      ctx!.closePath();
      ctx!.stroke();
      ctx!.restore();
    }
  }

  // ── PowerUp (triple disparo) ────────────────────────────────────────────
  class PowerUp {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    ttl: number;
    dead: boolean;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(20, 40);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.radius = 12;
      this.ttl = POWERUP_TTL;
      this.dead = false;
    }

    update(dt: number) {
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
      const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(Math.PI / 4);
      if (palette.glow > 0) {
        ctx!.shadowColor = palette.powerup;
        ctx!.shadowBlur = palette.glow;
      }
      ctx!.strokeStyle = palette.powerup;
      ctx!.lineWidth = 2;
      const r = this.radius * pulse;
      ctx!.strokeRect(-r, -r, r * 2, r * 2);
      ctx!.restore();
      withGlow(palette.powerup, () => {
        ctx!.fillStyle = palette.powerup;
        ctx!.font = "bold 12px monospace";
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText("3x", this.x, this.y);
      });
    }
  }

  // ── Ship ─────────────────────────────────────────────────────────────────
  class Ship {
    x = 0;
    y = 0;
    angle = 0;
    vx = 0;
    vy = 0;
    radius = 12;
    thrusting = false;
    invincible = 0;
    shootCooldown = 0;
    tripleShot = 0;
    dead = false;

    constructor() {
      this.tripleShot = 0;
      this.reset();
    }

    reset() {
      this.x = W / 2;
      this.y = H / 2;
      this.angle = -Math.PI / 2;
      this.vx = 0;
      this.vy = 0;
      this.radius = 12;
      this.thrusting = false;
      this.invincible = 3;
      this.shootCooldown = 0;
      this.dead = false;
    }

    update(dt: number) {
      if (this.dead) return;
      if (this.invincible > 0) this.invincible -= dt;
      if (this.shootCooldown > 0) this.shootCooldown -= dt;
      if (this.tripleShot > 0) this.tripleShot -= dt;

      const ROT = 3.5; // rad/s
      const THRUST = 260; // px/s²
      const DRAG = 0.987;

      if (keys["ArrowLeft"]) this.angle -= ROT * dt;
      if (keys["ArrowRight"]) this.angle += ROT * dt;

      this.thrusting = !!keys["ArrowUp"];
      if (this.thrusting) {
        this.vx += Math.cos(this.angle) * THRUST * dt;
        this.vy += Math.sin(this.angle) * THRUST * dt;
      }

      this.vx *= DRAG;
      this.vy *= DRAG;
      this.x = wrap(this.x + this.vx * dt, W);
      this.y = wrap(this.y + this.vy * dt, H);
    }

    tryShoot(): Bullet[] {
      if (this.shootCooldown > 0 || this.dead) return [];
      this.shootCooldown = 0.2;
      const NOSE = 21;
      const ox = this.x + Math.cos(this.angle) * NOSE;
      const oy = this.y + Math.sin(this.angle) * NOSE;
      if (this.tripleShot > 0) {
        return [
          new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
          new Bullet(ox, oy, this.angle),
          new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
        ];
      }
      return [new Bullet(ox, oy, this.angle)];
    }

    draw() {
      if (this.dead) return;
      // Parpadeo durante invencibilidad de reaparición
      if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

      ctx!.save();
      ctx!.translate(this.x, this.y);
      ctx!.rotate(this.angle);
      if (palette.glow > 0) {
        ctx!.shadowColor = palette.nave;
        ctx!.shadowBlur = palette.glow;
      }
      ctx!.strokeStyle = palette.nave;
      ctx!.lineWidth = 1.5;
      ctx!.lineJoin = "round";

      // Silueta clásica: triángulo con muesca trasera
      ctx!.beginPath();
      ctx!.moveTo(20, 0); // nariz
      ctx!.lineTo(-12, -9); // ala izquierda
      ctx!.lineTo(-7, 0); // muesca trasera
      ctx!.lineTo(-12, 9); // ala derecha
      ctx!.closePath();
      ctx!.stroke();

      // Llama del propulsor
      if (this.thrusting && Math.random() > 0.35) {
        ctx!.beginPath();
        ctx!.moveTo(-8, -4);
        ctx!.lineTo(-8 - rand(6, 14), 0);
        ctx!.lineTo(-8, 4);
        if (palette.glow > 0) ctx!.shadowColor = palette.propulsor;
        ctx!.strokeStyle = palette.propulsor;
        ctx!.stroke();
      }

      ctx!.restore();
    }
  }

  // ── Partículas (explosión) ─────────────────────────────────────────────────
  class Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    ttl: number;
    dead: boolean;

    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 130);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.life = rand(0.4, 1.1);
      this.ttl = this.life;
      this.dead = false;
    }

    update(dt: number) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.ttl -= dt;
      if (this.ttl <= 0) this.dead = true;
    }

    draw() {
      const alpha = this.ttl / this.life;
      withGlow(`rgb(${palette.particula})`, () => {
        ctx!.strokeStyle = `rgba(${palette.particula},${alpha.toFixed(2)})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.moveTo(this.x, this.y);
        ctx!.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
        ctx!.stroke();
      });
    }
  }

  // ── Estado del juego (por instancia) ───────────────────────────────────────
  let ship: Ship;
  let bullets: Bullet[];
  let asteroids: Asteroid[];
  let particles: Particle[];
  let powerUps: PowerUp[];
  let score: number;
  let lives: number;
  let level: number;
  let state: GameState;
  let deadTimer = 0;
  let powerUpSpawned = false;
  let killsSinceSpawn = 0;

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

  function spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      asteroids.push(new Asteroid(x, y, 3));
    }
  }

  function initGame() {
    ship = new Ship();
    bullets = [];
    asteroids = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    score = 0;
    lives = 3;
    level = 1;
    state = "playing";
    gameOverEmitted = false;
    spawnAsteroids(4);
  }

  function nextLevel() {
    level++;
    bullets = [];
    particles = [];
    powerUps = [];
    powerUpSpawned = false;
    killsSinceSpawn = 0;
    ship.reset();
    spawnAsteroids(3 + level);
  }

  function explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
  }

  function killShip() {
    explode(ship.x, ship.y, 14);
    ship.dead = true;
    lives--;
    if (lives <= 0) {
      state = "gameover";
    } else {
      state = "dead";
      deadTimer = 2;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (state === "gameover") {
      // El reinicio con Espacio se desactiva: lo controla la plataforma (restart()).
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      return;
    }

    if (state === "dead") {
      deadTimer -= dt;
      particles.forEach((p) => p.update(dt));
      particles = particles.filter((p) => !p.dead);
      asteroids.forEach((a) => a.update(dt));
      if (deadTimer <= 0) {
        state = "playing";
        ship.reset();
      }
      return;
    }

    if (pressed("Space")) {
      bullets.push(...ship.tryShoot());
    }

    ship.update(dt);
    bullets.forEach((b) => b.update(dt));
    asteroids.forEach((a) => a.update(dt));
    particles.forEach((p) => p.update(dt));
    powerUps.forEach((p) => p.update(dt));

    bullets = bullets.filter((b) => !b.dead);
    particles = particles.filter((p) => !p.dead);
    powerUps = powerUps.filter((p) => !p.dead);

    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        ship.tripleShot = POWERUP_DURATION;
      }
    }

    // Bala vs asteroide
    const newAsteroids: Asteroid[] = [];
    for (const b of bullets) {
      for (const a of asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          score += POINTS[a.size];
          explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!powerUpSpawned) {
            killsSinceSpawn++;
            const guaranteed = killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              powerUps.push(new PowerUp(a.x, a.y));
              powerUpSpawned = true;
            }
          }
        }
      }
    }
    asteroids = asteroids.filter((a) => !a.dead).concat(newAsteroids);
    bullets = bullets.filter((b) => !b.dead);

    // Nave vs asteroide
    if (ship.invincible <= 0) {
      for (const a of asteroids) {
        if (dist(ship, a) < ship.radius + a.radius * 0.82) {
          killShip();
          break;
        }
      }
    }

    // Nivel completado
    if (asteroids.length === 0) nextLevel();
  }

  // ── Draw (solo área de juego + indicador 3x; sin HUD ni overlay) ───────────
  function drawTripleIndicator() {
    if (ship.tripleShot > 0) {
      ctx!.textAlign = "left";
      ctx!.textBaseline = "alphabetic";
      ctx!.fillStyle = palette.indicador;
      ctx!.font = "15px monospace";
      ctx!.fillText(`3x  ${ship.tripleShot.toFixed(1)}s`, 14, 26);
    }
  }

  function draw() {
    ctx!.fillStyle = palette.fondo;
    ctx!.fillRect(0, 0, W, H);

    particles.forEach((p) => p.draw());
    asteroids.forEach((a) => a.draw());
    powerUps.forEach((p) => p.draw());
    bullets.forEach((b) => b.draw());
    ship.draw();

    drawTripleIndicator();
  }

  // ── Loop principal ─────────────────────────────────────────────────────────
  let paused = false;
  let lastTime: number | null = null;
  let rafId = 0;
  let destroyed = false;

  function loop(ts: number) {
    if (destroyed) return;
    rafId = requestAnimationFrame(loop);
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitChanges();
    }
    draw();
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
    },
    setPaused(p: boolean) {
      paused = p;
      if (p) {
        // Descarta el input en buffer para no disparar/moverse al reanudar.
        for (const k in justPressed) justPressed[k] = false;
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
      palette = ASTEROIDS_SKINS[skin];
    },
  };
}
