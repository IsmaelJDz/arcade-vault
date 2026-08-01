# SPEC 08 — Portar el juego Arkanoid (`bloque-buster`) a la plataforma

> **Estado:** Aprobado
> **Depende de:** `01-visual-screens-app-router.md` (reproductor `/play/[id]`, sesión + `saveScore`, `GAMES`), `05-asteroids-game.md` (patrón de motor portado + reproductor/HUD/pausa/modal, HUD con Vidas), `06-games-scores-leaderboard.md` (tablas `games`/`scores` + Hall, slug `bloque-buster` ya sembrado).
> **Fecha:** 2026-08-01
> **Objetivo:** Portar el Arkanoid de `references/started-games/04-arkanoid/` como el juego real de `/play/bloque-buster`, con HUD (Puntuación/Vidas/Nivel), 5 niveles, sonido de rebote/ruptura, pausa, fin de partida (perder o completar) y guardado en `scores`, reemplazando la simulación actual del slug `bloque-buster` (sin sembrar fila nueva), redibujando los sprites en estilo vector-neón.

## Alcance

**Dentro:**

- **Motor `lib/games/bloque-buster.ts` (nuevo)** — port TS de `game.js` + `levels.js`: paddle, pelota, 5 niveles (`LEVELS` con patrones y multiplicador de velocidad), colisión AABB con bloques/paredes/paddle, vidas, score, animación de explosión y estado `playing/gameover/win`. Sin globals ni acceso al DOM al importar. Contrato: `initBloqueBuster(canvas, handlers) → { destroy, setPaused, restart }`. El motor dibuja **solo el área de juego** (paddle, pelota, bloques, explosiones) **redibujados en vector-neón** (`fillRect`+glow / `arc`), **no** el HUD ni overlays de PAUSA/GAME OVER/victoria (los pinta React). Reproduce los 2 efectos de sonido en rebote/ruptura.
- **Assets de sonido (`public/games/bloque-buster/`, nuevo)** — copiar `ball-bounce.mp3` y `break-sound.mp3` a `public/`; el motor los carga y reproduce (rebotes solapables vía `cloneNode`), con limpieza en `destroy`.
- **Wrapper React `app/play/[id]/bloque-buster-game.tsx` (nuevo)** — client component (`forwardRef`) que monta el `<canvas>` 800×600 interno, llama a `initBloqueBuster`, cablea callbacks al HUD (`onScore/onLives/onLevel/onGameOver`), conecta PAUSA (`setPaused`), FIN (fuerza game over), JUGAR DE NUEVO (`restart`), SALIR; limpia con `destroy()` al desmontar.
- **`app/play/[id]/page.tsx` (modificado)** — el branch `id === "bloque-buster"` deja de usar `SimulatedPlayer` y pasa a `<BloqueBusterPlayer>` (real, modelo `AsteroidsPlayer`); reusa `PlayerHud` (variante **Vidas**), `PauseOverlay`, `CrtBottom`, `EndModal`. Los demás ids siguen en simulación.
- **Captura de teclado** — `preventDefault` solo de `ArrowLeft/ArrowRight` y solo mientras el motor está activo; listeners removidos en `destroy`.
- **CSS (`app/globals.css`)** — regla `.bloque-buster-canvas` (absolute-fill del `.crt-screen`, `object-fit:contain`, ratio 4:3 sin letterbox); reusa `.game-controls`/`.keyboard-notice` con la media query `(pointer: coarse)`.

**Fuera de alcance:**

- **Sembrar fila / tocar catálogo** — `bloque-buster` ya existe en `public.games` (ARCADE, `cover-bricks`, cyan, `best 28450`, `plays 12.4K`); **no** se inserta fila, **no** se toca `GAMES` ni el CSS de portada, **no** se regeneran tipos.
- **Sprites del PNG original** — se redibuja en vector-neón; `spritesheet-breakout.png` y su helper **no** se portan.
- **Mouse / salto-de-nivel en pausa** — se descartan el `mousemove` del paddle y los botones 1–5 del overlay de pausa del original.
- **Tecla `P`/`Escape` de pausa** — la controla el botón PAUSA de la plataforma.
- **Portar los otros juegos** — siguen en simulación. Controles táctiles, mejor score persistente, ranking/`best`/`plays` en vivo, dificultad configurable. Tests (no hay runner).

## Modelo de datos

**No introduce datos persistidos nuevos.** La fila `bloque-buster` ya está en `public.games`; `scores` recibe `INSERT` al jugar vía el `saveScore` existente (spec 06). Portar este juego **no cambia esquema** ni requiere `apply_migration`/`generate_typescript_types`. Los assets de sonido son estáticos en `public/` (no son datos de DB).

**Contrato del motor `lib/games/bloque-buster.ts`:**

```ts
interface BloqueBusterHandlers {
  onScore: (score: number) => void; // score acumulado (10 pts/bloque)
  onLives: (lives: number) => void; // 3 → 0
  onLevel: (level: number) => void; // 1..5, sube al limpiar el campo
  onGameOver: (finalScore: number) => void; // vidas a 0 (derrota) o nivel 5 limpio (victoria)
}

interface BloqueBusterControls {
  destroy: () => void; // detiene el loop, quita listeners y libera el audio
  setPaused: (paused: boolean) => void; // congela update; sigue dibujando
  restart: () => void; // reinicia la partida (initGame): nivel 1, vidas 3, score 0
}

function initBloqueBuster(
  canvas: HTMLCanvasElement,
  handlers: BloqueBusterHandlers,
): BloqueBusterControls;
```

Convenciones (heredadas de 05/06 + específicas del juego):

- **Canvas interno fijo 800×600** (constantes del juego); el escalado es solo CSS (ratio 4:3, `object-fit:contain`).
- **Callbacks en cambios**, no cada frame: `onScore` al romper bloque; `onLives` al perder la pelota; `onLevel` al avanzar de nivel; `onGameOver` **una sola vez** — tanto en derrota (vidas a 0) como en victoria (limpiar el nivel 5). El wrapper/React no distingue victoria de derrota: ambos abren el modal de FIN con el score final.
- **`setPaused(true)`** salta `update(dt)` pero sigue dibujando el último frame; al reanudar se resetea `lastTime` para no acumular tiempo (evita el salto).
- **`destroy()`** cancela el `requestAnimationFrame`, remueve los listeners de teclado y suelta las referencias de `Audio`.
- **Sonido**: dos `Audio` (`/games/bloque-buster/ball-bounce.mp3`, `/games/bloque-buster/break-sound.mp3`); se reproducen con `cloneNode().play()` para permitir rebotes solapados (patrón del original); errores de reproducción (autoplay) se ignoran silenciosamente.
- **Redibujo vector-neón**: paddle y bloques como `fillRect` con `shadowBlur`/glow en el color del bloque (paleta original `red/yellow/cyan/magenta/hotpink/green/gray`), pelota como `arc`, explosión como destello/partículas en el color del bloque (reemplaza los 4 frames del spritesheet). Reglas de colisión y coordenadas **idénticas** al original (área interna 800×600).
- **`player_name`/`user_id`** los pone el provider desde la sesión; el llamador solo pasa `{ game:"bloque-buster", score }`.

## Plan de implementación

Cada paso deja el sistema compilando y navegable. Antes de tocar routing/params leer la guía en `node_modules/next/dist/docs/` (Next.js 16).

1. **Assets de sonido** — copiar `references/started-games/04-arkanoid/assets/sounds/{ball-bounce,break-sound}.mp3` a `public/games/bloque-buster/`. **Prueba:** ambos archivos existen bajo `public/` y son servibles en `/games/bloque-buster/ball-bounce.mp3`.

2. **Motor `lib/games/bloque-buster.ts`** — portar `game.js` + `levels.js`: mover constantes (`PADDLE_SPEED`, `BLOCK_*`, `BASE_BALL_*`) y estado (`paddle/ball/blocks/explosions/lives/score/currentLevel/gameState`) y `LEVELS` dentro de `initBloqueBuster`; usar el `ctx` del canvas recibido (no `document.getElementById`); funciones `initPaddle/initBall/loadLevel/collideAABB/update/draw` como cierres locales; registrar `keydown/keyup` en init (solo `ArrowLeft/ArrowRight`) y guardarlos para `destroy`; **quitar** `mousemove`, el `click` de salto-de-nivel, `drawPauseOverlay`, `drawOverlay` (GAME OVER/victoria) y el HUD dibujado en canvas; **redibujar** paddle/pelota/bloques/explosiones en vector-neón; cargar los 2 `Audio` y reproducirlos con `cloneNode()` en rebote/ruptura; emitir `onScore/onLives/onLevel/onGameOver` en las transiciones (victoria nivel 5 → `onGameOver`); exponer `destroy/setPaused/restart`; `preventDefault` solo de las teclas del juego. **Prueba:** `npm run build` compila; el import no toca el DOM.

3. **Wrapper `app/play/[id]/bloque-buster-game.tsx`** — client `forwardRef`: `canvasRef` + `controlsRef`; `handlersRef` refrescado cada render; boot en `useEffect([])` que retorna `destroy`; pausa por prop `useEffect([paused])` → `setPaused`; `useImperativeHandle` expone `restart`. Render: `<canvas width={800} height={600} className="bloque-buster-canvas">`. **Prueba:** monta el canvas y el juego corre con `←/→`; se oye rebote/ruptura.

4. **Integración en `app/play/[id]/page.tsx`** — añadir el branch `id === "bloque-buster"` → `<BloqueBusterPlayer>` (copia de `AsteroidsPlayer`: estado `score/lives/level/paused/over/saveState`; HUD **Puntuación/Vidas/Nivel** vía `PlayerHud` variante `lives`); PAUSA→`setPaused`; FIN→game over; `onGameOver`→modal; GUARDAR→`saveScore({ game:"bloque-buster", score })`; JUGAR DE NUEVO→`restart` + reset estado; SALIR→`/game/bloque-buster`. Ajustar la leyenda de controles a `◄ ► MOVER`. **Prueba:** `/play/bloque-buster` jugable con HUD real; otros ids siguen simulados.

5. **CSS `app/globals.css`** — regla `.bloque-buster-canvas` (absolute-fill del `.crt-screen`, `object-fit:contain`, fondo negro, ratio 4:3); reusar `.game-controls`/`.keyboard-notice` con `(pointer: coarse)`. **Prueba:** el canvas se ve completo y proporcional (4:3) en distintos anchos; en móvil aparece el aviso "requiere teclado".

6. **Pausa e input pulidos** — verificar que `setPaused(true)` congela sin acumular `dt`, que `←/→` no hacen scroll de la página, y que al salir (`destroy`) se remueven los listeners y se libera el audio (navegar fuera y volver). **Prueba:** pausar/reanudar no da saltos; sin scroll; sin loops/listeners/audio duplicados.

7. **Verificación** — `npm run build` + `npm run lint` sin errores. Recorrido: Biblioteca → Detalle `bloque-buster` → JUGAR → romper bloques (score/vidas/nivel reales suben/bajan, la pelota acelera por nivel) → **perder** las 3 vidas **o completar** el nivel 5 → modal de FIN con score final → GUARDAR (logueado, persiste en `scores`) → Hall de `bloque-buster` muestra la marca → JUGAR DE NUEVO reinicia → SALIR. Confirmar que otro juego (`rocas`/`caida` reales, `serpentina` simulado) siguen bien. **Prueba:** el recorrido pasa.

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` compila sin errores; `npm run lint` pasa.
- [ ] `/play/bloque-buster` renderiza el juego real (canvas) en vez de la simulación.
- [ ] Otro id (p. ej. `/play/serpentina`) sigue mostrando la simulación falsa.
- [ ] `lib/games/bloque-buster.ts` no accede al DOM al importarse (solo dentro de `initBloqueBuster`).
- [ ] No se sembró fila nueva en `games`; `bloque-buster` conserva `best/plays/cover/color/cat` originales.

**Jugabilidad y HUD**

- [ ] `←`/`→` mueven el paddle; la pelota rebota en paredes, paddle y bloques.
- [ ] Romper un bloque suma 10 pts, lo hace desaparecer con destello y actualiza el score.
- [ ] Perder la pelota (cae bajo el canvas) descuenta una vida y reposiciona la pelota.
- [ ] Limpiar todos los bloques avanza al siguiente nivel; la pelota acelera ~10% por nivel.
- [ ] El HUD React refleja el estado **real**: Puntuación / Vidas / Nivel.
- [ ] El juego se dibuja en vector-neón y **no** dibuja su HUD ni overlays de PAUSA/GAME OVER/victoria en el canvas.
- [ ] Se oyen los efectos de rebote y de ruptura de bloque.
- [ ] PAUSA congela y muestra "EN PAUSA"; REANUDAR continúa sin salto de tiempo.
- [ ] FIN termina la partida y abre el modal con el score actual.

**Fin, guardado y Hall**

- [ ] Perder las 3 vidas **o** completar el nivel 5 abre el modal de FIN con el score final (no reinicia con Espacio).
- [ ] Logueado, GUARDAR inserta en `scores` `{ game_id:"bloque-buster", user_id, player_name, score }`.
- [ ] Invitado: el modal muestra "inicia sesión para guardar tu marca" y no inserta.
- [ ] Tras guardar y navegar al Hall, la marca de `bloque-buster` aparece (podio + tabla).

**Escalado, input y limpieza**

- [ ] El canvas se ve completo y proporcional (4:3) en distintos anchos; en móvil aparece el aviso "requiere teclado".
- [ ] `←`/`→` no hacen scroll de la página mientras se juega.
- [ ] Al navegar fuera de `/play/bloque-buster` y volver, no se duplican loops, listeners ni audio.

## Decisiones

- **Sí:** Reusar el slug existente `bloque-buster` (swap simulación → juego real), igual que `rocas`/`caida`.
  - **No:** crear un slug `arkanoid` nuevo (duplicaría el catálogo y exigiría seed innecesario).
- **Sí:** Motor como módulo TS con contrato `initBloqueBuster(canvas, handlers) → { destroy, setPaused, restart }`, sin globals.
  - **No:** cargar `game.js` tal cual (globals + `document.getElementById`, HUD/overlays/mouse en el DOM).
- **Sí:** Redibujar sprites en **vector-neón** (rects+glow / arc), coherente con `rocas`/`caida` y con el lenguaje visual de la plataforma.
  - **No:** portar `spritesheet-breakout.png` + helper (añade carga asíncrona de imagen, canvas negro hasta cargar y un asset extra que desentona con el resto).
- **Sí:** **Portar los 2 efectos de sonido** (rebote/ruptura) desde `public/`, con `cloneNode()` para solapado.
  - **No:** diferir el sonido (aunque spec 05 lo difirió, aquí se decidió incluirlo por feedback explícito).
- **Sí:** HUD React con **Vidas** (reusa la variante `lives` de `PlayerHud`, igual que `rocas`); handlers `onScore/onLives/onLevel`.
  - **No:** inventar un HUD nuevo; Arkanoid encaja en el de asteroids.
- **Sí:** Solo teclado `←/→`; pausa por el botón PAUSA; victoria y derrota → modal de FIN.
  - **No:** conservar mouse-move, el salto-de-nivel del overlay de pausa, ni las teclas `P`/`Escape` del original.

## Riesgos

| Riesgo                                                                                                     | Mitigación                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No limpiar rAF/listeners/audio al desmontar → loops/handlers/sonidos duplicados al navegar fuera y volver. | `destroy()` cancela el rAF, remueve `keydown/keyup` y suelta los `Audio`; el `useEffect` del wrapper lo llama en cleanup. Criterio específico lo valida. |
| Acceso al DOM al importar el módulo → error SSR/build.                                                     | Todo el DOM/`Audio` vive dentro de `initBloqueBuster` (llamado desde `useEffect`, solo cliente). Criterio lo verifica.                                   |
| El redibujo vector-neón altera tamaños/colisiones respecto al original.                                    | Colisiones y coordenadas se mantienen idénticas (área interna 800×600, mismas cajas AABB); solo cambia el `draw` (relleno+glow en vez de `drawImage`).   |
| Autoplay del navegador bloquea el primer `.play()` (sin gesto de usuario) o los rebotes solapados saturan. | El juego arranca tras interacción (clic en JUGAR); errores de `play()` se ignoran (`catch`); `cloneNode()` por evento evita cortar el sonido previo.     |
| Tras pausar, `dt` acumula y la pelota "salta" al reanudar.                                                 | `setPaused(true)` salta `update`; al reanudar se resetea `lastTime` (patrón de spec 05).                                                                 |
| `preventDefault` mal acotado secuestra el teclado del sitio.                                               | Solo `ArrowLeft/ArrowRight` y solo mientras el motor está activo; removido en `destroy`.                                                                 |
| `restart()` deja estado viejo (bloques rotos, explosiones, nivel/vidas).                                   | `restart` llama a `initGame` (reset completo: nivel 1, vidas 3, score 0, `loadLevel(1)`).                                                                |
| La victoria (nivel 5 limpio) no dispara fin de partida y el juego queda "colgado".                         | El estado `win` emite `onGameOver(score)` una sola vez, igual que la derrota; ambos abren el modal de FIN.                                               |

## Lo que **no** entra en esta spec

- Portar los otros juegos del catálogo (siguen en simulación).
- Sembrar/editar el catálogo (`bloque-buster` ya existe) ni los sprites del PNG.
- Mouse, salto-de-nivel en pausa, teclas `P`/`Escape`, controles táctiles.
- Mejor score persistente, ranking en vivo, `best`/`plays` en vivo, dificultad configurable.
- Tests automatizados.
