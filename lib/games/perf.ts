/**
 * Probe de trabajo por frame para los criterios de rendimiento de la spec 12.
 *
 * Por qué existe: el overlay de FPS mide el intervalo entre callbacks de
 * `requestAnimationFrame`, que con vsync está clavado en el periodo de la
 * pantalla (~16.7 ms a 60 Hz) haga el juego el trabajo que haga. Esa cifra es
 * insensible a lo que la spec optimiza. Lo que sí responde es el tiempo que se
 * pasa *dentro* de `update()` + `draw()`, y eso es lo que mide este módulo.
 *
 * Limitación conocida: `performance.now()` alrededor del cuerpo del loop mide
 * el coste de JS y de grabar los comandos de canvas, **no** el rasterizado, que
 * Chrome hace después y en otro proceso. Las optimizaciones que descargan al
 * rasterizador (quitar `shadowBlur`) quedan subestimadas aquí; para verlas hay
 * que medir con CPU throttling, donde el raster entra en el presupuesto.
 *
 * Está apagado salvo que el overlay lo encienda con `?debug=fps`. Deshabilitado
 * el coste por frame son dos llamadas a función y un `if` sobre un booleano.
 */

// Mismo esquema de histograma que el overlay: bins de 0.25 ms hasta 128 ms.
// Evita guardar (y ordenar) un array que crece con la partida.
const BIN_MS = 0.25;
const BINS = 512;

// Trabajo que no cuenta como frame: breakpoint, GC largo, pestaña suspendida
// entre el frameStart() y el frameEnd().
const OUTLIER_MS = 1000;

let enabled = false;
let started = 0;

const bins = new Uint32Array(BINS + 1);
let frames = 0;
let totalMs = 0;
let maxMs = 0;

export type FrameStats = {
  /** Media de ms de trabajo por frame desde el último reset. */
  avgMs: number;
  /** p95 de ms de trabajo por frame, resuelto sobre el histograma. */
  p95Ms: number;
  /** Frame de trabajo más caro visto. */
  maxMs: number;
  /** Frames contabilizados (excluye outliers). */
  frames: number;
};

export function resetFrameProbe() {
  bins.fill(0);
  frames = 0;
  totalMs = 0;
  maxMs = 0;
}

export function enableFrameProbe() {
  resetFrameProbe();
  enabled = true;
}

export function disableFrameProbe() {
  enabled = false;
  resetFrameProbe();
}

export function frameStart() {
  if (!enabled) return;
  started = performance.now();
}

export function frameEnd() {
  if (!enabled) return;
  const ms = performance.now() - started;
  if (ms < 0 || ms >= OUTLIER_MS) return;
  frames++;
  totalMs += ms;
  if (ms > maxMs) maxMs = ms;
  bins[Math.min(BINS, Math.floor(ms / BIN_MS))]++;
}

export function readFrameStats(): FrameStats {
  if (frames === 0) return { avgMs: 0, p95Ms: 0, maxMs: 0, frames: 0 };

  const target = Math.ceil(frames * 0.95);
  let acc = 0;
  let p95Ms = BINS * BIN_MS;
  for (let i = 0; i <= BINS; i++) {
    acc += bins[i];
    if (acc >= target) {
      p95Ms = i * BIN_MS;
      break;
    }
  }

  return { avgMs: totalMs / frames, p95Ms, maxMs, frames };
}
