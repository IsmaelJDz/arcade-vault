"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { type AsteroidsControls, initAsteroids } from "@/lib/games/asteroids";
import type { SkinId } from "@/lib/games/skins";

export interface AsteroidsGameHandle {
  restart: () => void;
}

interface AsteroidsGameProps {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  paused: boolean;
  skin: SkinId;
}

const AsteroidsGame = forwardRef<AsteroidsGameHandle, AsteroidsGameProps>(function AsteroidsGame(
  { onScore, onLives, onLevel, onGameOver, paused, skin },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<AsteroidsControls | null>(null);

  // Handlers siempre frescos sin re-inicializar el motor en cada render.
  const handlersRef = useRef({ onScore, onLives, onLevel, onGameOver });
  useEffect(() => {
    handlersRef.current = { onScore, onLives, onLevel, onGameOver };
  });

  // Skin vía ref para pintar el primer frame con la persistida sin re-montar.
  const skinRef = useRef(skin);
  useEffect(() => {
    skinRef.current = skin;
  });

  // Arranca el motor una vez al montar; lo destruye al desmontar.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controls = initAsteroids(
      canvas,
      {
        onScore: (n) => handlersRef.current.onScore(n),
        onLives: (n) => handlersRef.current.onLives(n),
        onLevel: (n) => handlersRef.current.onLevel(n),
        onGameOver: (n) => handlersRef.current.onGameOver(n),
      },
      { skin: skinRef.current },
    );
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

  // Skin dirigida por prop: cambio de paleta en vivo, sin reiniciar la partida.
  useEffect(() => {
    controlsRef.current?.setSkin(skin);
  }, [skin]);

  useImperativeHandle(ref, () => ({ restart: () => controlsRef.current?.restart() }), []);

  return <canvas ref={canvasRef} width={800} height={600} className="asteroids-canvas" />;
});

export default AsteroidsGame;
