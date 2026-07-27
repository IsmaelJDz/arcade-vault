# SPEC 05 — Portar el juego Asteroids (`rocas`) a la plataforma

> **Estado:** Implementado
> **Depende de:** `01-visual-screens-app-router.md` (reproductor `/play/[id]`, sesión + `saveScore`, `GAMES`). Coexiste con `04-supabase-auth.md` (usa `user`/`saveScore` de la sesión sin depender de auth real).
> **Fecha:** 2026-07-27
> **Objetivo:** Portar el juego Asteroids de `references/started-games/02-asteroids/` como el primer juego real de la plataforma, integrándolo en `/play/rocas` con el HUD, pausa, fin de partida y guardado de puntuación de la plataforma, dejando los otros 7 juegos en la simulación actual.

Notas de contexto:

- **Fuente**: `references/started-games/02-asteroids/game.js` — juego canvas autónomo (800×600), sin dependencias ni sonido, con clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp` y loop `requestAnimationFrame`.
- **Primer juego real**: el resto de `GAMES` sigue con la simulación falsa de spec 01. El Arkanoid del historial es solo fuente de referencia, no está integrado.
- **Sin backend**: `saveScore` sigue en `localStorage` (`av_scores`), igual que hoy; la migración a DB es otra spec.
- **Power-up 3x**: el juego trae triple disparo; se conserva.

---

## Alcance

**Dentro:**

- **Motor portado (`lib/games/asteroids.ts`, nuevo)** — port TypeScript de `game.js`: clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y la lógica de loop/colisiones/niveles. Sin globals ni acceso directo al DOM al importar. Contrato:
  - `initAsteroids(canvas, handlers) → { destroy(), setPaused(b), restart() }`.
  - `handlers`: `onScore(score)`, `onLives(lives)`, `onLevel(level)`, `onGameOver(score)`.
  - El motor dibuja **solo el área de juego** + el indicador del power-up **3x** en el canvas. **No** dibuja el HUD de score/vidas/nivel (lo pinta React) ni el overlay de GAME OVER (lo pinta el modal de la plataforma). El reinicio con `Espacio` en game over se **desactiva**.
- **Wrapper React (`app/play/[id]/asteroids-game.tsx`, nuevo)** — client component que monta el `<canvas>` a 800×600 interno, llama a `initAsteroids`, cablea los callbacks al HUD React, conecta el botón PAUSA (`setPaused`), el botón FIN (fuerza game over), "JUGAR DE NUEVO" (`restart`) y "SALIR". Limpia el motor (`destroy`) al desmontar. Muestra la **leyenda de controles** en desktop y un **aviso "requiere teclado"** en móvil/touch.
- **`app/play/[id]/page.tsx` (modificado)** — condición por id: `rocas` → `<AsteroidsGame>`; los demás ids → la simulación falsa actual (sin registro genérico). El HUD React, el overlay "EN PAUSA" y el modal de FIN con `saveScore` se reutilizan tal cual, ahora alimentados por el estado real del juego.
- **Captura de teclado** — `preventDefault` **solo** de `ArrowLeft/ArrowRight/ArrowUp/Space` y **solo** mientras el juego está montado/activo; listeners removidos en `destroy`.
- **Escalado** — canvas con resolución interna 800×600, escalado por CSS al contenedor CRT (aspect-ratio 4:3, `max-width:100%`, letterbox). Sin tocar `W`/`H`/wrapping.
- **CSS (`app/globals.css`)** — clases mínimas para el canvas dentro del `.crt-screen` y para la leyenda/aviso de controles.

**Fuera de alcance (specs futuras):**

- **Portar los otros juegos** (`caida`, `serpentina`, etc.) — siguen en simulación.
- **Controles táctiles / móvil jugable** — solo aviso "requiere teclado".
- **Guardado de puntuación en DB / leaderboards reales** — sigue `localStorage`; es otra spec.
- **Sonido, nuevas mecánicas o rediseño del juego** — port fiel; el 3x existente se conserva pero no se añaden power-ups nuevos.
- **Registro/loader genérico de juegos** — el `switch` por id basta para un juego.
- **Guardar el mejor score, ranking, dificultad configurable** — no.
- **Tests** (no hay runner).

---

## Modelo de datos

Esta feature **no introduce datos persistidos nuevos** — reusa `saveScore({ game, score, name })` → `localStorage` `av_scores` (spec 01). Lo que sí define es el **contrato público del motor** (lo interno —clases `Bullet`/`Asteroid`/`Ship`/`Particle`/`PowerUp`, `RADII`/`SPEEDS`/`POINTS`— es port directo de `game.js` y no forma parte del contrato).

**`lib/games/asteroids.ts` — contrato del motor:**

```ts
interface AsteroidsHandlers {
  onScore: (score: number) => void; // score acumulado
  onLives: (lives: number) => void; // 3 → 0
  onLevel: (level: number) => void; // sube al limpiar el campo
  onGameOver: (finalScore: number) => void; // lives llega a 0
}

interface AsteroidsControls {
  destroy: () => void; // detiene el loop y quita listeners
  setPaused: (paused: boolean) => void; // congela update (sigue montado)
  restart: () => void; // reinicia la partida (initGame)
}

function initAsteroids(canvas: HTMLCanvasElement, handlers: AsteroidsHandlers): AsteroidsControls;
```

Convenciones:

- **Canvas fijo 800×600** (constantes internas `W`/`H`); el escalado es solo CSS.
- **Callbacks disparados en cambios**, no cada frame: `onScore` cuando cambia el score, `onLives`/`onLevel` en transición, `onGameOver` una sola vez al pasar a `gameover`.
- **`setPaused(true)`** salta `update(dt)` pero sigue dibujando el último frame; al reanudar, `dt` se resetea para no acumular tiempo (evita el salto tras la pausa).
- **`destroy()`** cancela el `requestAnimationFrame` y remueve los listeners de teclado — indispensable al navegar fuera (SPA).
- **Teclas del juego** (`ArrowLeft/Right/Up`, `Space`) con `preventDefault` solo mientras el motor está activo.
- El **botón FIN** de la plataforma provoca game over vía el motor (o fuerza `onGameOver` con el score actual); no hay un estado de score paralelo en React que se pueda desincronizar.

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable. El juego es canvas puro (sin APIs de Next), pero el wrapper y la página son client components — antes de tocar routing/params leer el guía en `node_modules/next/dist/docs/`.

1. **Motor `lib/games/asteroids.ts`** — portar `game.js` a un módulo TS: mover los globals (`ship`, `bullets`, `asteroids`, …) y clases dentro de `initAsteroids(canvas, handlers)`; usar el `ctx` del canvas recibido (no `document.getElementById`); registrar los listeners de teclado en `init` y guardarlos para `destroy`; exponer `destroy/setPaused/restart`. Quitar del `draw` el HUD de score/vidas/nivel y el overlay de GAME OVER (los pone la plataforma); conservar el indicador 3x. Disparar `onScore/onLives/onLevel/onGameOver` en las transiciones. `preventDefault` solo de las teclas del juego. Prueba: `npm run build` compila; import del módulo resuelve tipos.

2. **Wrapper `app/play/[id]/asteroids-game.tsx`** — client component: `<canvas width={800} height={600}>` vía `ref`; en `useEffect` llamar `initAsteroids` con handlers que hacen `setScore/setLives/setLevel/setOver`; `destroy()` en el cleanup. Props para recibir del padre: `onGameOver` (abre modal), estado `paused`, y refs a `restart`. Prueba: montar el wrapper aislado renderiza el canvas y el juego corre con teclado.

3. **Integración en `app/play/[id]/page.tsx`** — condición `id === "rocas"` → render `<AsteroidsGame>` dentro del `.crt-screen` en vez de la `.game-arena` falsa; el resto de ids conserva la simulación. Sustituir el ticker falso y el `lives` estático por el estado real que emiten los callbacks. Cablear: PAUSA → `setPaused`; FIN → forzar game over; `onGameOver` → abrir el modal existente; GUARDAR → `saveScore({ game:"rocas", score, name })`; "JUGAR DE NUEVO" → `restart()` + cerrar modal; SALIR → `/game/rocas`. Prueba: `/play/rocas` es jugable con HUD real; otros ids siguen simulados.

4. **Escalado + CSS (`app/globals.css`)** — estilos para el canvas dentro del `.crt-screen` (aspect-ratio 4:3, `max-width:100%`, centrado, letterbox), la leyenda de controles (desktop) y el aviso "requiere teclado" (móvil/touch). Prueba: el canvas se ve completo y proporcional en distintos anchos; en móvil aparece el aviso.

5. **Pausa e input pulidos** — verificar que `setPaused(true)` congela sin acumular `dt`, que las flechas/Espacio no hacen scroll de la página mientras se juega, y que al salir (`destroy`) los listeners se remueven (probar navegando fuera y volviendo). Prueba: pausar/reanudar no da saltos; sin scroll con flechas; navegar fuera y volver no duplica loops ni listeners.

6. **Limpieza y verificación** — `npm run build` + `npm run lint` sin errores. Recorrido: Biblioteca → Detalle `rocas` → JUGAR → romper asteroides (score/vidas/nivel reales suben/bajan) → perder 3 vidas → modal de FIN con score final → GUARDAR (persiste en `av_scores`) → JUGAR DE NUEVO reinicia → SALIR. Confirmar que otro juego (p. ej. `caida`) sigue en simulación. Prueba: el recorrido completo pasa.

Notas de conversión:

- El motor es agnóstico de React; toda la UI (HUD, pausa, modal) vive en la página/wrapper.
- `performance.now()`/`requestAnimationFrame`/`Math.random` solo corren en cliente dentro de `initAsteroids` (llamado desde `useEffect`), nunca en render → sin mismatch SSR.
- Nada de `window.X = X`; el módulo exporta `initAsteroids`.

---

## Criterios de aceptación

**Build y integración**

- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] `npm run lint` pasa sin errores.
- [ ] `/play/rocas` renderiza el juego real (canvas) en vez de la simulación falsa.
- [ ] Otro id (p. ej. `/play/caida`) sigue mostrando la simulación falsa actual.
- [ ] `lib/games/asteroids.ts` no accede al DOM al importarse (solo dentro de `initAsteroids`).

**Jugabilidad**

- [ ] `←`/`→` rotan la nave, `↑` propulsa, `Espacio` dispara.
- [ ] Los asteroides grandes se parten en medianos y estos en pequeños; los pequeños desaparecen.
- [ ] Al destruir un asteroide, el score sube según su tamaño (20/50/100) y hay partículas de explosión.
- [ ] Chocar con un asteroide resta una vida y la nave reaparece con invencibilidad temporal (parpadeo).
- [ ] Limpiar el campo pasa al siguiente nivel con más asteroides.
- [ ] El power-up 3x aparece y otorga triple disparo temporal (indicador dibujado en el canvas).

**HUD y estado de la plataforma**

- [ ] El HUD React (Puntuación/Vidas/Nivel) refleja el estado **real** del juego, no valores simulados.
- [ ] El juego **no** dibuja su propio HUD de score/vidas/nivel ni el overlay de GAME OVER en el canvas.
- [ ] PAUSA congela el juego y muestra el overlay "EN PAUSA"; REANUDAR continúa sin salto de tiempo.
- [ ] FIN termina la partida y abre el modal de FIN con el score actual.

**Fin de partida y guardado**

- [ ] Perder las 3 vidas abre el modal de FIN con el score final (no reinicia con Espacio).
- [ ] GUARDAR persiste `{ game:"rocas", score, name }` en `av_scores`.
- [ ] "JUGAR DE NUEVO" reinicia la partida real (score/vidas/nivel a inicial) y cierra el modal.
- [ ] "SALIR" navega al detalle `/game/rocas`.

**Escalado, input y limpieza**

- [ ] El canvas se ve completo y proporcional (4:3) en distintos anchos de ventana.
- [ ] En móvil/touch se muestra el aviso "requiere teclado"; en desktop, la leyenda de controles.
- [ ] Las flechas y Espacio no hacen scroll de la página mientras se juega.
- [ ] Al navegar fuera de `/play/rocas` y volver, no se duplican loops ni listeners (el motor se destruye al desmontar).

---

## Decisiones

- **Sí:** Solo `rocas` pasa a juego real; los otros 7 siguen en simulación. Alcance acotado a un juego; el patrón se reutiliza después.
  - **No:** Portar varios juegos a la vez. Multiplicaría el riesgo y las decisiones sin necesidad.
- **Sí:** HUD React alimentado por callbacks del motor (`onScore/onLives/onLevel`); el juego dibuja solo el área de juego. Chrome consistente con la plataforma.
  - **No:** Mantener el HUD que el juego dibuja en canvas. Duplicaría la información y rompería la consistencia visual con el resto del reproductor.
- **Sí:** Game over del juego → modal de FIN de la plataforma + `saveScore`; se desactiva el reinicio con Espacio del juego. Integra el guardado real de puntuación existente.
  - **No:** Conservar el "ESPACIO para reiniciar" del juego. Evitaría el guardado y daría dos flujos de fin de partida en conflicto.
- **Sí:** Pausa que congela el loop, cableada al botón PAUSA; FIN fuerza game over. El juego original no tenía pausa; la plataforma la ofrece.
  - **No:** Dejar el juego sin pausa. El botón PAUSA quedaría muerto o inconsistente.
- **Sí:** Motor como módulo TS con contrato `initAsteroids(canvas, handlers) → { destroy, setPaused, restart }`, sin globals. Encapsula el juego, permite limpieza en SPA y da forma reutilizable a futuros juegos.
  - **No:** Cargar `game.js` tal cual (globals + `document.getElementById`). Fugaría estado global, no limpiaría listeners y rompería con SSR/navegación.
- **Sí:** Resolución interna fija 800×600 escalada por CSS (letterbox 4:3). Cero cambios en la física/wrapping del juego.
  - **No:** Canvas de dimensiones dinámicas. Obligaría a refactorizar `W`/`H`/wrapping con riesgo de romper el feel.
- **Sí:** `preventDefault` solo de las teclas del juego y solo mientras está activo. Evita el scroll con flechas/Espacio sin secuestrar el teclado del resto del sitio.
  - **No:** `preventDefault` global o listeners permanentes. Romperían el scroll/atajos fuera del juego y fugarían handlers.
- **Sí:** En móvil/touch, aviso "requiere teclado" sin controles táctiles. El juego depende de teclado; los táctiles son otra spec.
  - **No:** Implementar controles táctiles ahora. Trabajo considerable fuera del objetivo de portar.
- **Sí:** `switch`/condición por id en `page.tsx`, sin registro genérico. Suficiente para un juego.
  - **No:** Loader/registro genérico de juegos. Sobre-ingeniería con un solo juego real.
- **Sí:** Guardado sigue en `localStorage` (`av_scores`). Consistente con el estado actual del proyecto.
  - **No:** Guardar en DB aquí. Es el alcance de la spec de scores, no de portar el juego.

---

## Riesgos

| Riesgo                                                                                                                                                               | Mitigación                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El motor no limpia el `requestAnimationFrame`/listeners al desmontar → al navegar fuera y volver se acumulan loops (doble velocidad) y handlers de teclado fantasma. | `destroy()` cancela el rAF y remueve los listeners; el `useEffect` del wrapper lo llama en el cleanup. Criterio de aceptación específico lo valida navegando fuera y volviendo. |
| Acceso al DOM (`document.getElementById`, `window`) en el cuerpo del módulo → error en SSR/build al importar `asteroids.ts`.                                         | Todo acceso al DOM vive **dentro** de `initAsteroids` (llamado desde `useEffect`, solo cliente); el módulo no toca el DOM al importarse. Criterio de aceptación lo verifica.    |
| `preventDefault` mal acotado secuestra el teclado del resto del sitio o, al revés, no evita el scroll con flechas/Espacio dentro del juego.                          | `preventDefault` solo de `Arrow*`/`Space` y solo mientras el motor está activo; se remueve en `destroy`.                                                                        |
| Desincronización entre el score interno del juego y el HUD/modal de React (dos fuentes de verdad).                                                                   | El motor es la única fuente; React solo refleja callbacks. FIN provoca game over vía el motor (`onGameOver`), no arma un score paralelo.                                        |
| Tras pausar, `dt` acumula el tiempo transcurrido y el primer frame al reanudar da un "salto" (asteroides teletransportados).                                         | Al reanudar se resetea `lastTime`/`dt` (como el cap de 50ms del original); `setPaused(true)` salta `update` pero sigue dibujando.                                               |
| El escalado CSS del canvas 800×600 deforma el juego o desalinea las colisiones (que usan coordenadas internas).                                                      | Las colisiones usan siempre coordenadas internas 800×600; el CSS solo escala visualmente con aspect-ratio 4:3 fijo, sin tocar `W`/`H`.                                          |
| `restart()` deja estado viejo (balas, partículas, power-ups) o no resetea vidas/nivel → partida corrupta.                                                            | `restart` llama a `initGame` (reset completo de todas las listas y de score/lives/level), igual que el arranque.                                                                |

---

## Lo que **no** entra en esta spec

- Portar los otros juegos del catálogo (siguen en simulación).
- Controles táctiles / móvil jugable.
- Guardado en DB / leaderboards reales (sigue `localStorage`).
- Sonido, nuevas mecánicas o rediseño del juego.
- Registro/loader genérico de juegos.
- Mejor score persistente, ranking, dificultad configurable.
- Tests automatizados.

Cada uno de estos, si llega, va en su propia spec.
