"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TouchDir = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

interface TouchAction {
  label: string;
  code: "Space" | "ArrowUp";
}

interface TouchLayout {
  dirs: TouchDir[];
  actions: TouchAction[];
}

const TOUCH_LAYOUTS: Record<string, TouchLayout> = {
  // Convención: un mismo `code` no puede aparecer en dos controles de un layout.
  rocas: {
    dirs: ["ArrowLeft", "ArrowRight", "ArrowUp"],
    actions: [{ label: "DISPARAR", code: "Space" }],
  },
  caida: {
    dirs: ["ArrowLeft", "ArrowRight", "ArrowDown"],
    actions: [
      { label: "ROTAR", code: "ArrowUp" },
      { label: "CAER", code: "Space" },
    ],
  },
  "bloque-buster": {
    dirs: ["ArrowLeft", "ArrowRight"],
    actions: [],
  },
  serpentina: {
    dirs: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
    actions: [],
  },
  frogger: {
    dirs: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
    actions: [],
  },
};

const REPEAT_DELAY_MS = 350;
const REPEAT_INTERVAL_MS = 120;

// Flechas del D-pad MK-II (triángulos de references/gamepad-assets/gamepad.html)
const DIR_ARROWS: Record<TouchDir, string> = {
  ArrowUp: "M12 4 L20 16 L4 16 Z",
  ArrowRight: "M8 4 L20 12 L8 20 Z",
  ArrowDown: "M4 8 L20 8 L12 20 Z",
  ArrowLeft: "M16 4 L16 20 L4 12 Z",
};

const DIR_AREAS: Record<TouchDir, string> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

// Cada `code` de acción tiene letra y color fijos (convención MK-II):
const ACTION_STYLES: Record<TouchAction["code"], { letter: "A" | "B"; tone: "a" | "b" }> = {
  Space: { letter: "A", tone: "a" }, // magenta, siempre a la derecha
  ArrowUp: { letter: "B", tone: "b" }, // cyan, siempre a la izquierda de A
};

interface HeldTimers {
  delay: number | null;
  interval: number | null;
}

function dispatchKey(type: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat }));
}

export interface TouchControlsProps {
  game: string;
  disabled: boolean;
}

export default function TouchControls({ game, disabled }: TouchControlsProps) {
  const layout = TOUCH_LAYOUTS[game];
  const heldRef = useRef<Map<string, HeldTimers>>(new Map());
  const disabledRef = useRef(disabled);
  const [pressed, setPressed] = useState<ReadonlySet<string>>(new Set());

  const release = useCallback((code: string) => {
    const timers = heldRef.current.get(code);
    if (!timers) return;
    if (timers.delay !== null) window.clearTimeout(timers.delay);
    if (timers.interval !== null) window.clearInterval(timers.interval);
    heldRef.current.delete(code);
    dispatchKey("keyup", code);
    setPressed((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  }, []);

  const releaseAll = useCallback(() => {
    for (const code of Array.from(heldRef.current.keys())) release(code);
  }, [release]);

  const press = useCallback((code: string) => {
    if (disabledRef.current || heldRef.current.has(code)) return;
    dispatchKey("keydown", code);
    const timers: HeldTimers = { delay: null, interval: null };
    timers.delay = window.setTimeout(() => {
      timers.delay = null;
      timers.interval = window.setInterval(() => {
        dispatchKey("keydown", code, true);
      }, REPEAT_INTERVAL_MS);
    }, REPEAT_DELAY_MS);
    heldRef.current.set(code, timers);
    setPressed((prev) => new Set(prev).add(code));
  }, []);

  useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  useEffect(() => releaseAll, [releaseAll]);

  if (!layout) return null;

  const controlHandlers = (code: string) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      press(code);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // pointer ya liberado: la pulsación queda registrada igualmente
      }
    },
    onPointerUp: () => release(code),
    onPointerCancel: () => release(code),
    onPointerLeave: () => release(code),
  });

  // B siempre a la izquierda de A, sin importar el orden del layout
  const orderedActions = [...layout.actions].sort(
    (x, y) =>
      Number(ACTION_STYLES[x.code].letter === "A") - Number(ACTION_STYLES[y.code].letter === "A"),
  );

  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-shell" role="group" aria-label="Gamepad">
        <div className="touch-shell-body">
          <div className="touch-dpad">
            {layout.dirs.map((dir) => (
              <button
                key={dir}
                type="button"
                className={`touch-btn touch-dir touch-dir-${DIR_AREAS[dir]}${pressed.has(dir) ? " pressed" : ""}`}
                aria-label={DIR_AREAS[dir]}
                {...controlHandlers(dir)}
              >
                <svg className="touch-dir-arrow" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={DIR_ARROWS[dir]} fill="currentColor" />
                </svg>
              </button>
            ))}
            <div className="touch-hub" aria-hidden="true">
              <span className="touch-hub-gem" />
            </div>
          </div>
          <div className="touch-actions">
            {orderedActions.map((action) => {
              const style = ACTION_STYLES[action.code];
              return (
                <div key={action.code} className="touch-action-slot">
                  <button
                    type="button"
                    className={`touch-btn touch-action touch-ab-${style.tone}${pressed.has(action.code) ? " pressed" : ""}`}
                    aria-label={`${style.letter}: ${action.label}`}
                    {...controlHandlers(action.code)}
                  >
                    <span className="touch-ab-ring" aria-hidden="true" />
                    <span className="touch-ab-letter">{style.letter}</span>
                  </button>
                  <span className="touch-action-label">{action.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
