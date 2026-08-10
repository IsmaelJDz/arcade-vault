"use client";

import { useEffect, useRef, useState } from "react";

// Umbral de "frame largo": a 60 fps el presupuesto es 16.7 ms; por encima de 20
// ms el frame ya se comió su turno y el input se lee tarde.
const LONG_FRAME_MS = 20;

// Histograma de ms/frame para el p95: bins de 0.25 ms hasta 128 ms. Evita
// guardar (y ordenar) un array que crece con la partida.
const BIN_MS = 0.25;
const BINS = 512;

// Salto de tiempo que no cuenta como frame: pestaña oculta, breakpoint, etc.
const OUTLIER_MS = 1000;

/**
 * Overlay de medición para los criterios de rendimiento de la spec 12.
 * Se activa solo con `?debug=fps` y escribe en el DOM por `ref`: un `setState`
 * por frame reintroduciría el coste que la spec elimina y falsearía la medida.
 */
export default function FpsOverlay() {
  const [enabled, setEnabled] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // La query se lee en un efecto y no con `useSearchParams`: en el App Router
  // ese hook obliga a envolver la ruta en <Suspense> y fuerza render en cliente
  // de todo el árbol, un coste real en producción por una herramienta de debug.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lectura única de la query en cliente
    if (params.get("debug") === "fps") setEnabled(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const box = boxRef.current;
    if (!box) return;

    const bins = new Uint32Array(BINS + 1);
    let frames = 0;
    let longFrames = 0;
    let windowFrames = 0;
    let rafId = 0;

    const started = performance.now();
    let windowStart = started;
    let last = started;

    const p95 = () => {
      if (frames === 0) return 0;
      const target = Math.ceil(frames * 0.95);
      let acc = 0;
      for (let i = 0; i <= BINS; i++) {
        acc += bins[i];
        if (acc >= target) return i * BIN_MS;
      }
      return BINS * BIN_MS;
    };

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);

      const dt = now - last;
      last = now;
      if (dt > 0 && dt < OUTLIER_MS) {
        frames++;
        windowFrames++;
        bins[Math.min(BINS, Math.floor(dt / BIN_MS))]++;
        if (dt > LONG_FRAME_MS) longFrames++;
      }

      // Refresco de texto una vez por segundo: la media móvil es el ratio real
      // de frames del último tramo, no un promedio de fps instantáneos.
      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        const fps = (windowFrames * 1000) / elapsed;
        const minutes = (now - started) / 60000;
        const perMin = minutes > 0 ? longFrames / minutes : 0;
        box.textContent =
          `FPS ${fps.toFixed(1)}\n` +
          `p95 ${p95().toFixed(2)} ms\n` +
          `>${LONG_FRAME_MS}ms ${longFrames} (${perMin.toFixed(1)}/min)\n` +
          `frames ${frames}`;
        windowFrames = 0;
        windowStart = now;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  if (!enabled) return null;

  // Estilos en línea a propósito: el overlay no forma parte del lenguaje visual
  // de la app y no debe dejar reglas muertas en globals.css.
  return (
    <div
      ref={boxRef}
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 30,
        padding: "6px 8px",
        borderRadius: 6,
        background: "rgba(0, 0, 0, 0.65)",
        border: "1px solid rgba(0, 245, 255, 0.4)",
        color: "#00f5ff",
        font: "11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace",
        whiteSpace: "pre",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      midiendo…
    </div>
  );
}
