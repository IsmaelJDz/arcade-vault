# SPEC 07 — Portar el juego Tetris (`caida`) a la plataforma

> **Estado:** Aprobado
> **Depende de:** `01-visual-screens-app-router.md` (reproductor `/play/[id]`, sesión + `saveScore`, `GAMES`), `05-asteroids-game.md` (patrón de motor portado + reproductor/HUD/pausa/modal), `06-games-scores-leaderboard.md` (tablas `games`/`scores` + Hall, slug `caida` ya sembrado).
> **Fecha:** 2026-07-28
> **Objetivo:** Portar el Tetris de `references/started-games/03-tetris/` como el juego real de `/play/caida`, con HUD (Puntuación/Líneas/Nivel), preview de próxima pieza, pausa, fin de partida y guardado en `scores`, reemplazando la simulación actual del slug `caida` (sin sembrar fila nueva).

---

## Alcance

**Dentro:**

- **Motor `lib/games/caida.ts` (nuevo)** — port TS de `references/started-games/03-tetris/game.js`: tablero `10×20`, piezas (incluida la tuerca `N`), rotación con wall-kicks, colisión, line-clear, ghost piece, hard/soft drop, scoring y velocidad por nivel. Sin globals ni acceso al DOM al importar. Contrato: `initCaida(canvas, handlers) → { destroy, setPaused, restart }`. El motor dibuja **solo el tablero** (grid + bloques fijos + fantasma + pieza actual) en el canvas principal; **no** dibuja HUD ni overlay de PAUSA/GAME OVER (los pinta React). Emite la próxima pieza por `onNext`; expone un helper puro para pintarla.
- **Wrapper React `app/play/[id]/caida-game.tsx` (nuevo)** — client component (`forwardRef`) que monta el `<canvas>` del tablero a **300×600** interno, llama a `initCaida`, cablea callbacks al HUD, dibuja el **mini-canvas de próxima pieza** al recibir `onNext`, conecta PAUSA (`setPaused`), FIN (fuerza game over), JUGAR DE NUEVO (`restart`), SALIR; limpia con `destroy()` al desmontar.
- **`app/play/[id]/page.tsx` (modificado)** — el branch `id === "caida"` deja de usar `SimulatedPlayer` y pasa a `<CaidaPlayer>` (real). Los demás ids siguen en simulación. Se reutiliza el chrome del reproductor (`.crt`/`.crt-screen`, `PauseOverlay`, `CrtBottom`, `EndModal`); el HUD se adapta a **Puntuación / Líneas / Nivel** (variante de `PlayerHud` o `PlayerHud` parametrizado).
- **Captura de teclado** — `preventDefault` solo de `ArrowLeft/ArrowRight/ArrowDown/ArrowUp/Space` y solo mientras el motor está activo; listeners removidos en `destroy`.
- **CSS (`app/globals.css`)** — regla `.caida-canvas` (fill del `.crt-screen`, `object-fit:contain`, fondo negro → pillarbox por el ratio 1:2) y `.caida-next` para el mini-canvas de preview; reusa `.game-controls`/`.keyboard-notice` con la media query `(pointer: coarse)`.

**Fuera de alcance:**

- **Sembrar fila / tocar catálogo** — `caida` ya existe en `public.games` (PUZZLE, `cover-tetro`, magenta, `best 184220`, `plays 31.8K`); **no** se inserta fila nueva, **no** se toca `GAMES` ni el CSS de portada, **no** se regeneran tipos.
- **Portar los otros juegos** — siguen en simulación.
- **Tema claro/oscuro y `localStorage` del original** — no se portan (la plataforma tiene su propio theming; los scores viven en DB).
- **Tecla `P` de pausa** — la pausa la controla el botón PAUSA de la plataforma.
- Controles táctiles, mejor score persistente, ranking en vivo, dificultad configurable, `best`/`plays` en vivo, sonido. Tests (no hay runner).

## Modelo de datos

**No introduce datos persistidos nuevos.** La fila `caida` ya está en `public.games`; `scores` recibe `INSERT` al jugar vía el `saveScore` existente (spec 06). Portar este juego **no cambia esquema** ni requiere `apply_migration`/`generate_typescript_types`.

**Contrato del motor `lib/games/caida.ts`:**

```ts
interface NextPiece {
  type: number; // 1..8 (índice de color/pieza; 8 = tuerca N)
  shape: number[][]; // matriz de la próxima pieza
}

interface CaidaHandlers {
  onScore: (score: number) => void; // score acumulado
  onLines: (lines: number) => void; // líneas totales limpiadas
  onLevel: (level: number) => void; // floor(lines/10)+1
  onNext: (piece: NextPiece) => void; // próxima pieza (para el preview React)
  onGameOver: (finalScore: number) => void; // al colisionar el spawn
}

interface CaidaControls {
  destroy: () => void; // detiene el loop y quita listeners
  setPaused: (paused: boolean) => void; // congela update; sigue dibujando
  restart: () => void; // reinicia la partida (init)
}

function initCaida(canvas: HTMLCanvasElement, handlers: CaidaHandlers): CaidaControls;

// Exports auxiliares para el preview (evitan duplicar la paleta en React):
export const CAIDA_COLORS: (string | null)[]; // paleta indexada 1..8
export function drawNextPreview(canvas: HTMLCanvasElement, piece: NextPiece): void;
```

Convenciones (heredadas de 05/06 + específicas del juego):

- **Canvas interno fijo 300×600** (`COLS·BLOCK × ROWS·BLOCK` = 10·30 × 20·30); escalado solo por CSS con `object-fit:contain` (pillarbox dentro del `.crt-screen` 4:3).
- **Callbacks en cambios**, no cada frame: `onScore/onLines/onLevel` al cambiar; `onNext` en cada `spawn`; `onGameOver` una sola vez.
- **`setPaused(true)`** salta el `update` (acumulación de `dropAccum`) pero sigue dibujando el último frame; al reanudar se resetea `lastTime` para no acumular tiempo (evita el salto).
- **`destroy()`** cancela el `requestAnimationFrame` y remueve el listener de teclado.
- **Scoring/velocidad idénticos al original**: `LINE_SCORES=[0,100,300,500,800]×level`, hard-drop `+2/celda`, soft-drop `+1/fila`; `level=floor(lines/10)+1`; `dropInterval=max(100, 1000-(level-1)·90)` ms.
- **`player_name`/`user_id`** los pone el provider desde la sesión; el llamador solo pasa `{ game:"caida", score }`.

## Plan de implementación

Cada paso deja el sistema compilando y navegable. Antes de tocar routing/params leer la guía en `node_modules/next/dist/docs/` (Next.js 16).

1. **Motor `lib/games/caida.ts`** — portar `game.js`: mover constantes (`COLS/ROWS/BLOCK/COLORS/PIECES/LINE_SCORES`) y estado (`board/current/next/score/lines/level/…`) dentro de `initCaida`; usar el `ctx` del canvas recibido; funciones `collide/rotateCW/tryRotate/merge/clearLines/ghostY/hardDrop/softDrop/lockPiece/spawn/draw` como cierres locales; registrar el listener de teclado en init y guardarlo para `destroy`; quitar `updateHUD` en canvas, el overlay DOM (`endGame`/`togglePause` visuales) y el toggle de tema; emitir `onScore/onLines/onLevel/onNext/onGameOver` en las transiciones; `preventDefault` solo de las teclas del juego; exportar `CAIDA_COLORS` y `drawNextPreview`. **Prueba:** `npm run build` compila; el import no toca el DOM.
2. **Wrapper `app/play/[id]/caida-game.tsx`** — client `forwardRef`: `canvasRef` (tablero) + `nextRef` (preview) + `controlsRef`; `handlersRef` refrescado cada render; boot en `useEffect([])` que retorna `destroy`; en `onNext` guardar la pieza en estado y dibujarla con `drawNextPreview(nextRef, piece)`; pausa por prop `useEffect([paused])`; `useImperativeHandle` expone `restart`. Render: `<canvas ... className="caida-canvas">` + `<canvas className="caida-next">`. **Prueba:** monta y el juego corre con teclado; el preview muestra la próxima pieza.
3. **Integración en `app/play/[id]/page.tsx`** — cambiar el branch `caida` a `<CaidaPlayer>` (modelo `AsteroidsPlayer`): estado `score/lines/level/paused/over/saveState`; HUD **Puntuación/Líneas/Nivel**; PAUSA→`setPaused`; FIN→game over; `onGameOver`→modal; GUARDAR→`saveScore({ game:"caida", score })`; JUGAR DE NUEVO→`restart` + reset estado; SALIR→`/game/caida`. **Prueba:** `/play/caida` jugable con HUD real; otros ids siguen simulados.
4. **CSS `app/globals.css`** — `.caida-canvas` (absolute-fill, `object-fit:contain`, fondo negro) y `.caida-next` (tamaño/estilo del mini-canvas en el HUD lateral); reusar `.game-controls`/`.keyboard-notice`. **Prueba:** el tablero se ve completo y proporcional (pillarbox) en distintos anchos; en móvil aparece el aviso.
5. **Pausa e input pulidos** — verificar que `setPaused(true)` congela sin acumular `dropAccum`, que flechas/Espacio no hacen scroll, y que al salir (`destroy`) se remueve el listener (navegar fuera y volver). **Prueba:** pausar/reanudar no da saltos; sin scroll; sin loops/listeners duplicados.
6. **Verificación** — `npm run build` + `npm run lint` sin errores. Recorrido: Biblioteca → Detalle `caida` → JUGAR → limpiar líneas (score/líneas/nivel reales suben, velocidad aumenta) → perder (spawn colisiona) → modal de FIN con score final → GUARDAR (logueado, persiste en `scores`) → Hall de `caida` muestra la marca → JUGAR DE NUEVO reinicia → SALIR. Confirmar que otro juego (p. ej. `rocas` real y `serpentina` simulado) siguen bien. **Prueba:** el recorrido pasa.

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` compila sin errores; `npm run lint` pasa.
- [ ] `/play/caida` renderiza el juego real (canvas) en vez de la simulación.
- [ ] Otro id (p. ej. `/play/serpentina`) sigue mostrando la simulación falsa.
- [ ] `lib/games/caida.ts` no accede al DOM al importarse (solo dentro de `initCaida`).
- [ ] No se sembró fila nueva en `games`; `caida` conserva `best/plays/cover/color/cat` originales.

**Jugabilidad y HUD**

- [ ] `←`/`→` mueven, `↓` soft-drop, `↑`/`X` rotan (con wall-kick), `Espacio` hard-drop.
- [ ] Completar filas las limpia y suma según `LINE_SCORES×nivel`; la velocidad sube cada 10 líneas.
- [ ] La pieza fantasma (ghost) se muestra bajo la pieza actual.
- [ ] El mini-canvas muestra correctamente la **próxima pieza** y se actualiza en cada spawn.
- [ ] El HUD React refleja el estado **real**: Puntuación / Líneas / Nivel.
- [ ] El juego **no** dibuja su HUD ni el overlay de PAUSA/GAME OVER en el canvas.
- [ ] PAUSA congela y muestra "EN PAUSA"; REANUDAR continúa sin salto de tiempo.
- [ ] FIN termina la partida y abre el modal con el score actual.

**Fin, guardado y Hall**

- [ ] Perder (spawn colisiona) abre el modal de FIN con el score final (no reinicia con Espacio).
- [ ] Logueado, GUARDAR inserta en `scores` `{ game_id:"caida", user_id, player_name, score }`.
- [ ] Invitado: el modal muestra "inicia sesión para guardar tu marca" y no inserta.
- [ ] Tras guardar y navegar al Hall, la marca de `caida` aparece (podio + tabla).

**Escalado, input y limpieza**

- [ ] El tablero se ve completo y proporcional (1:2, pillarbox) en distintos anchos; en móvil aparece el aviso "requiere teclado".
- [ ] Flechas y Espacio no hacen scroll de la página mientras se juega.
- [ ] Al navegar fuera de `/play/caida` y volver, no se duplican loops ni listeners.

## Decisiones

- **Sí:** Reusar el slug existente `caida` (swap simulación → juego real), igual que `rocas`/asteroids.
  - **No:** crear un slug `tetris` nuevo (duplicaría el catálogo y exigiría seed innecesario).
- **Sí:** Motor como módulo TS con contrato `initCaida(canvas, handlers) → { destroy, setPaused, restart }`, sin globals.
  - **No:** cargar `game.js` tal cual (globals + `document.getElementById`, overlay/HUD/tema en el DOM).
- **Sí:** HUD React con **Líneas** en lugar de Vidas (Tetris no tiene vidas); handlers `onScore/onLines/onLevel`.
  - **No:** forzar el HUD genérico con "Vidas".
- **Sí:** Próxima pieza vía `onNext` + mini-canvas React, con el motor exponiendo `drawNextPreview`/`CAIDA_COLORS` (una sola fuente de la paleta).
  - **No:** dibujar el "next" dentro del canvas principal (rompería el ratio 1:2 y mezclaría chrome con área de juego); tampoco omitir el preview (mecánica clásica de Tetris).
- **Sí:** Pausa cableada al botón PAUSA; FIN fuerza game over.
  - **No:** conservar la tecla `P` ni el "Espacio para reiniciar" del original.
- **Sí:** Descartar tema/`localStorage` del juego.
  - **No:** portarlos (la plataforma tiene theming propio; scores en DB).

## Riesgos

| Riesgo                                                                                       | Mitigación                                                                                                                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| No limpiar rAF/listeners al desmontar → loops/handlers duplicados al navegar fuera y volver. | `destroy()` cancela el rAF y remueve el listener; el `useEffect` del wrapper lo llama en cleanup. Criterio específico lo valida. |
| Acceso al DOM al importar el módulo → error SSR/build.                                       | Todo el DOM vive dentro de `initCaida` (llamado desde `useEffect`, solo cliente). Criterio lo verifica.                          |
| Duplicar la paleta de colores en React desincroniza el preview del tablero.                  | El motor exporta `CAIDA_COLORS` + `drawNextPreview`; el wrapper no reimplementa colores.                                         |
| Tras pausar, `dropAccum`/`dt` acumulan y la pieza "salta" varias filas al reanudar.          | `setPaused(true)` detiene `update`; al reanudar se resetea `lastTime` (y `dropAccum` no crece en pausa).                         |
| El ratio 1:2 del tablero deforma o desalinea dentro del `.crt-screen` 4:3.                   | Resolución interna fija 300×600; el CSS solo escala con `object-fit:contain` (pillarbox), sin tocar `COLS/ROWS/BLOCK`.           |
| `restart()` deja tablero/pieza/score viejos → partida corrupta.                              | `restart` llama a `init` (reset completo de `board/score/lines/level/next` y emisión inicial de callbacks).                      |

## Lo que **no** entra en esta spec

- Portar los otros juegos del catálogo (siguen en simulación).
- Sembrar/editar el catálogo (`caida` ya existe).
- Tema claro/oscuro, `localStorage`, sonido, controles táctiles.
- Mejor score persistente, ranking en vivo, `best`/`plays` en vivo, dificultad configurable.
- Tests automatizados.
