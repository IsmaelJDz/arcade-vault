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
};

const REPEAT_DELAY_MS = 350;
const REPEAT_INTERVAL_MS = 120;

const DIR_GLYPHS: Record<TouchDir, string> = {
  ArrowLeft: "◄",
  ArrowRight: "►",
  ArrowUp: "▲",
  ArrowDown: "▼",
};

const DIR_AREAS: Record<TouchDir, string> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
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
      e.currentTarget.setPointerCapture(e.pointerId);
      press(code);
    },
    onPointerUp: () => release(code),
    onPointerCancel: () => release(code),
    onPointerLeave: () => release(code),
  });

  return (
    <div className="touch-controls" onContextMenu={(e) => e.preventDefault()}>
      <div className="touch-dpad">
        {layout.dirs.map((dir) => (
          <button
            key={dir}
            type="button"
            className={`touch-btn touch-dir touch-dir-${DIR_AREAS[dir]}${pressed.has(dir) ? " pressed" : ""}`}
            aria-label={DIR_AREAS[dir]}
            {...controlHandlers(dir)}
          >
            {DIR_GLYPHS[dir]}
          </button>
        ))}
      </div>
      <div className="touch-actions">
        {layout.actions.map((action) => (
          <button
            key={action.code}
            type="button"
            className={`touch-btn touch-action${pressed.has(action.code) ? " pressed" : ""}`}
            {...controlHandlers(action.code)}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
