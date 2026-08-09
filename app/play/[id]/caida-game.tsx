"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import { type CaidaControls, type NextPiece, drawNextPreview, initCaida } from "@/lib/games/caida";
import type { SkinId } from "@/lib/games/skins";

export interface CaidaGameHandle {
  restart: () => void;
}

interface CaidaGameProps {
  onScore: (score: number) => void;
  onLines: (lines: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  paused: boolean;
  skin: SkinId;
}

const CaidaGame = forwardRef<CaidaGameHandle, CaidaGameProps>(function CaidaGame(
  { onScore, onLines, onLevel, onGameOver, paused, skin },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null); // tablero
  const nextRef = useRef<HTMLCanvasElement>(null); // preview de la próxima pieza
  const controlsRef = useRef<CaidaControls | null>(null);

  // Handlers siempre frescos sin re-inicializar el motor en cada render.
  const handlersRef = useRef({ onScore, onLines, onLevel, onGameOver });
  useEffect(() => {
    handlersRef.current = { onScore, onLines, onLevel, onGameOver };
  });

  // Skin vía ref para pintar el primer frame con la persistida sin re-montar.
  const skinRef = useRef(skin);
  useEffect(() => {
    skinRef.current = skin;
  });

  // Última pieza emitida: el preview solo se repinta en onNext, así que hay que
  // conservarla para poder redibujarla cuando cambia la skin a media partida.
  const nextPieceRef = useRef<NextPiece | null>(null);

  // Arranca el motor una vez al montar; lo destruye al desmontar.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controls = initCaida(
      canvas,
      {
        onScore: (n) => handlersRef.current.onScore(n),
        onLines: (n) => handlersRef.current.onLines(n),
        onLevel: (n) => handlersRef.current.onLevel(n),
        onGameOver: (n) => handlersRef.current.onGameOver(n),
        onNext: (piece) => {
          nextPieceRef.current = piece;
          const nc = nextRef.current;
          if (nc) drawNextPreview(nc, piece, skinRef.current);
        },
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
  // El tablero se repinta solo en el loop; el preview hay que redibujarlo aquí.
  useEffect(() => {
    controlsRef.current?.setSkin(skin);
    const nc = nextRef.current;
    if (nc) drawNextPreview(nc, nextPieceRef.current, skin);
  }, [skin]);

  useImperativeHandle(ref, () => ({ restart: () => controlsRef.current?.restart() }), []);

  return (
    <>
      <canvas ref={canvasRef} width={300} height={600} className="caida-canvas" />
      <div className="caida-next-box">
        <span className="caida-next-label">SIGUIENTE</span>
        <canvas ref={nextRef} width={120} height={120} className="caida-next" />
      </div>
    </>
  );
});

export default CaidaGame;
