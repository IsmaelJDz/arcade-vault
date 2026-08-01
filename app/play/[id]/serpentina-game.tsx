"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { type SerpentinaControls, initSerpentina } from "@/lib/games/serpentina";

export interface SerpentinaGameHandle {
  restart: () => void;
}

interface SerpentinaGameProps {
  onScore: (score: number) => void;
  onLength: (length: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  paused: boolean;
}

const SerpentinaGame = forwardRef<SerpentinaGameHandle, SerpentinaGameProps>(
  function SerpentinaGame({ onScore, onLength, onLevel, onGameOver, paused }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const controlsRef = useRef<SerpentinaControls | null>(null);

    // Handlers siempre frescos sin re-inicializar el motor en cada render.
    const handlersRef = useRef({ onScore, onLength, onLevel, onGameOver });
    useEffect(() => {
      handlersRef.current = { onScore, onLength, onLevel, onGameOver };
    });

    // Arranca el motor una vez al montar; lo destruye al desmontar.
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const controls = initSerpentina(canvas, {
        onScore: (n) => handlersRef.current.onScore(n),
        onLength: (n) => handlersRef.current.onLength(n),
        onLevel: (n) => handlersRef.current.onLevel(n),
        onGameOver: (n) => handlersRef.current.onGameOver(n),
      });
      controlsRef.current = controls;
      return () => {
        controls.destroy();
        controlsRef.current = null;
      };
    }, []);

    // Pausa dirigida por prop.
    useEffect(() => {
      controlsRef.current?.setPaused(paused);
    }, [paused]);

    useImperativeHandle(ref, () => ({ restart: () => controlsRef.current?.restart() }), []);

    return <canvas ref={canvasRef} width={800} height={600} className="serpentina-canvas" />;
  },
);

export default SerpentinaGame;
