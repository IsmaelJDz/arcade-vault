# SPEC centella/02 — Motor `lib/games/centella.ts` (desde cero)

> **Estado:** Draft
> **Depende de:** `specs/game-jam/centella/01-game-design.md` (diseño), `specs/05-asteroids-game.md` (patrón de motor + convenciones de loop/limpieza), `specs/09-serpentina-game.md` (patrón de motor desde cero, ticks y `emitChanges`)
> **Fecha:** 2026-08-02
> **Objetivo:** Especificar al detalle el motor TypeScript de CENTELLA — contrato, parámetros numéricos, generación procedural, colisiones, marea, parpadeo y convenciones del repo — listo para implementarse sin decisiones abiertas.

---

## Contrato del motor

```ts
// lib/games/centella.ts

export interface CentellaHandlers {
  onScore: (score: number) => void; // score acumulado (+10/fila récord, +50/orbe)
  onLives: (lives: number) => void; // 3 → 0; se emite al perder vida y en restart
  onLevel: (level: number) => void; // floor(filaRecord / 20) + 1
  onGameOver: (finalScore: number) => void; // vidas a 0; se emite UNA sola vez
}

export interface CentellaControls {
  destroy: () => void; // cancela rAF y remueve listeners de teclado
  setPaused: (paused: boolean) => void; // congela update; sigue dibujando el último frame
  restart: () => void; // reinicia la partida completa y reemite el HUD
}

export function initCentella(
  canvas: HTMLCanvasElement,
  handlers: CentellaHandlers,
): CentellaControls;
```

Sin exports auxiliares: no hay preview ni paleta compartida con React (a diferencia de `caida`).

---

## Parámetros de diseño (números concretos)

### Canvas y grilla

| Parámetro          | Valor                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Resolución interna | **800×600** (ratio 4:3; escalado solo por CSS)                                                                            |
| Celda              | **40 px** → **20 columnas** × **15 filas** visibles                                                                       |
| Cámara             | `cameraRow = max(0, filaRecord - 8)`; interpolación exponencial (lerp factor `0.15` por frame a 60 fps) hacia el objetivo |

Coordenadas de mundo: fila `r` ocupa `y = -r * 40` relativo al arranque; el `draw` traduce con la cámara. El jugador vive en (colInt, filaInt) con interpolación visual de salto de **80 ms**.

### Jugador y movimiento

| Parámetro                | Valor                                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| Salto                    | 1 celda por pulsación (`↑↓←→`), animado 80 ms; **buffer de 1 input** durante la animación |
| Límites laterales        | columnas 0–19; fuera = input ignorado                                                     |
| Retroceso (`↓`)          | permitido; no puntúa ni des-puntúa                                                        |
| Hitbox                   | círculo de radio **14 px** centrado en la celda (perdona rozones)                         |
| Invulnerabilidad respawn | **1.5 s**, sprite parpadeando (alterna alpha 0.3/1.0 cada 100 ms)                         |

### Parpadeo (Espacio)

| Parámetro  | Valor                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Alcance    | **+2 filas**, misma columna                                                                                   |
| Cooldown   | **5 s** (5000 ms); ignorado si no está cargado                                                                |
| Animación  | 120 ms de destello (estela vertical magenta); invulnerable **solo** durante esos 120 ms                       |
| Aterrizaje | reglas normales de la celda destino (coche encima o plasma sin placa = muerte al terminar el destello)        |
| Indicador  | aura del sprite: cargado = halo blanco `shadowBlur 25`; recargando = sin halo; al recargarse, pulso de 200 ms |

### Generación procedural de filas

Generador incremental: se materializan filas hasta `cameraRow + 18` y se descartan estructuras por debajo de `cameraRow - 4`.

| Regla     | Valor                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------ |
| Filas 0–1 | SEGURA (arranque)                                                                                                        |
| Patrón    | tras cada SEGURA: bloque CARRETERA (60 %) de 2–4 filas o bloque RÍO (40 %) de 2–3 filas; luego **siempre** 1 fila SEGURA |
| Orbe      | 25 % de probabilidad por fila SEGURA (excepto filas 0–1), columna aleatoria 2–17                                         |
| RNG       | `Math.random()` por partida (no hay seed compartida ni replays)                                                          |

### Carriles de carretera

| Parámetro  | Valor                                                                       |
| ---------- | --------------------------------------------------------------------------- |
| Dirección  | alterna por fila (fila par →, impar ←, relativo al inicio del bloque)       |
| Velocidad  | base `90 + rand(0..40)` px/s por carril × multiplicador de nivel            |
| Coches     | ancho 1–2 celdas (40/80 px), alto 28 px; hitbox AABB exacta                 |
| Separación | gap aleatorio de **3–6 celdas** entre coches; a partir de nivel 5, 3–5      |
| Recorrido  | carril circular de `20 + 4` celdas (960 px); wrap-around, sin spawns nuevos |

### Río y placas

| Parámetro | Valor                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Dirección | alterna por fila                                                                                                |
| Velocidad | base `60 + rand(0..30)` px/s × multiplicador de nivel                                                           |
| Placas    | largo 2–4 celdas, alto 32 px; gap **2–4 celdas**; carril circular 960 px con wrap                               |
| Arrastre  | jugador sobre placa hereda `vx` (x continua); el input de salto lateral parte de la x actual redondeada a celda |
| Muerte    | centro del jugador sin placa debajo (plasma) o centro fuera de `[0, 800]` arrastrado                            |
| Garantía  | por construcción (gap ≤ 4 y largo ≥ 2) siempre hay placa alcanzable en cada carril                              |

### Marea de estática

| Parámetro        | Valor                                                      |
| ---------------- | ---------------------------------------------------------- |
| Velocidad        | **14 px/s** base × multiplicador propio de nivel           |
| Posición inicial | borde superior 6 filas (240 px) por debajo del jugador     |
| Muerte           | borde superior de la marea ≥ y del centro del jugador      |
| Tras respawn     | reposicionada 6 filas por debajo de la fila de reaparición |

### Score, nivel y multiplicadores

| Parámetro           | Valor                                                     |
| ------------------- | --------------------------------------------------------- |
| Fila récord         | **+10** (solo la primera vez que se alcanza esa fila)     |
| Orbe                | **+50**                                                   |
| Nivel               | `floor(filaRecord / 20) + 1`, sin tope                    |
| Mult. coches/placas | `min(2.5, 1.08^(nivel-1))`                                |
| Mult. marea         | `min(2.5, 1.10^(nivel-1))`                                |
| Vidas               | **3**; respawn en última fila SEGURA visitada, columna 10 |
| Respawn             | estallido 600 ms (partida sigue corriendo) → reaparición  |

---

## Convenciones heredadas del repo (obligatorias)

- **Nada de DOM ni `getContext` al importar** el módulo: constantes puras a nivel de módulo; todo estado, `ctx`, listeners y rAF viven **dentro** de `initCentella` (se llama desde `useEffect`, solo cliente).
- **Callbacks solo en cambios**, no cada frame: patrón `emitChanges()` con `lastScore/lastLives/lastLevel/gameOverEmitted`; `onGameOver` **una sola vez** por partida.
- **`setPaused(true)`** salta `update(dt)` pero sigue dibujando el último frame; al reanudar se resetea `lastTime` para no acumular `dt` (sin saltos de marea/coches). `dt` con clamp a **50 ms** máximo por frame.
- **`destroy()`** cancela el `requestAnimationFrame`, pone `destroyed = true` y remueve los listeners nombrados de `keydown`.
- **`restart()`** reinicia el estado completo (filas generadas, jugador, marea, score, vidas, nivel, cooldown, `gameOverEmitted`) y reemite todos los callbacks del HUD.
- **`preventDefault` acotado** a `ArrowUp/ArrowDown/ArrowLeft/ArrowRight/Space` (por `event.code`), solo mientras el motor vive.
- El motor dibuja **solo el área de juego** (bandas, coches, placas, orbes, marea, jugador y su aura); **no** dibuja HUD, ni overlays de PAUSA/GAME OVER, ni reinicia con Espacio (todo eso lo pinta/gestiona React).
- Tras `onGameOver`, el loop sigue dibujando el último estado (congelado) hasta `restart()` o `destroy()`.

---

## Estructura interna (cierres dentro de `initCentella`)

- Estado: `rows: Row[]` (anillo por rango visible), `player {col, row, x, y, hopT, alive, invulnT}`, `tideY`, `score`, `lives`, `level`, `maxRow`, `lastSafeRow`, `blinkCooldown`, `paused`, `destroyed`, `rafId`, `lastTime`, flags `last*` de emisión.
- Tipos internos: `type RowKind = "safe" | "road" | "river"`; `interface Row { kind; dir; speed; entities: { x; w }[]; orb?: { col; taken } }`.
- Funciones: `generateRowsUpTo(r)`, `handleKeyDown(e)` (nombrada, para remover), `tryHop(dx, dy)`, `tryBlink()`, `resolveCell()` (colisión coche / placa / plasma / orbe / marea), `killPlayer()`, `respawn()`, `update(dt)`, `draw()`, `emitChanges()`, `loop(t)`, `resetGame()`.

---

## Plan de implementación del motor

1. **Esqueleto y contrato** — crear `lib/games/centella.ts` con interfaces, `initCentella` que arma `ctx`, estado inicial, loop rAF vacío que limpia el canvas, y `destroy/setPaused/restart` operativos.
   **Prueba:** `npm run build` compila; importar el módulo en Node (build) no toca el DOM.
2. **Grilla, cámara y jugador estático** — dibujar bandas por tipo de fila (colores de la spec 01), generador procedural `generateRowsUpTo`, jugador con salto por flechas e interpolación de 80 ms, cámara con lerp.
   **Prueba:** en un harness temporal del wrapper, el jugador salta por celdas, la cámara sube al avanzar y las bandas siguen el patrón segura/carretera/río con franjas seguras garantizadas.
3. **Coches y colisión** — carriles circulares con wrap, velocidades y gaps de la tabla, AABB vs. círculo del jugador, `killPlayer` + respawn con invulnerabilidad.
   **Prueba:** cruzar un bloque de carretera es posible pero letal al contacto; morir reaparece en la última segura y emite `onLives`.
4. **Río, placas y arrastre** — placas con wrap, detección "sobre placa" por el centro, herencia de `vx`, muerte por plasma y por borde lateral.
   **Prueba:** montarse en una placa arrastra al jugador; pisar plasma mata; salir por el borde mata; saltar entre placas funciona.
5. **Marea de estática** — banda con ruido, subida con multiplicador, muerte por alcance, reposicionamiento tras respawn.
   **Prueba:** quedarse quieto en el arranque mata en ~15 s; tras morir, la marea queda 6 filas abajo.
6. **Parpadeo** — Espacio, +2 filas, cooldown 5 s, destello 120 ms, aterrizaje con reglas normales, aura de estado en el sprite.
   **Prueba:** el parpadeo atraviesa un carril; aterrizar en plasma mata; el aura refleja cargado/recargando; no responde durante cooldown.
7. **Score, nivel y emisiones** — fila récord +10, orbes +50, nivel y multiplicadores, `emitChanges` con flags, `onGameOver` único a vidas 0.
   **Prueba:** el HUD del wrapper refleja score/vidas/nivel exactos; oscilar arriba/abajo no re-puntúa; a vidas 0 llega un solo `onGameOver`.
8. **Pulido de convenciones** — pausa sin acumulación de `dt`, `restart` limpio, `destroy` sin fugas, `preventDefault` acotado, clamp de `dt`.
   **Prueba:** pausar 10 s y reanudar no teletransporta coches/marea; navegar fuera y volver no duplica loops ni listeners; `npm run build` + `npm run lint` pasan.

---

## Criterios de aceptación

- [ ] `lib/games/centella.ts` compila y no accede al DOM al importarse (todo dentro de `initCentella`).
- [ ] Contrato exacto: `initCentella(canvas, handlers) → { destroy, setPaused, restart }` con `CentellaHandlers`/`CentellaControls` exportados.
- [ ] Flechas saltan 1 celda con buffer de 1 input; Espacio parpadea 2 filas con cooldown de 5 s.
- [ ] Generación procedural cumple el patrón (segura obligatoria entre bloques; gaps de placas ≤ 4 celdas) — sin pasajes imposibles.
- [ ] Colisiones: coche mata, plasma sin placa mata, borde lateral arrastrado mata, marea mata; orbe suma y desaparece.
- [ ] Score +10 solo por fila récord; +50 por orbe; nivel `floor(filaRecord/20)+1`; multiplicadores con tope ×2.5.
- [ ] `onScore/onLives/onLevel` solo en cambios; `onGameOver` exactamente una vez con el score final.
- [ ] `setPaused(true)` congela `update` pero sigue dibujando; reanudar resetea el reloj (sin salto de `dt`).
- [ ] `destroy()` cancela rAF y remueve listeners; sin fugas al desmontar/remontar.
- [ ] `restart()` reinicia todo (mundo, marea, cooldown, flags) y reemite el HUD inicial (score 0, 3 vidas, nivel 1).
- [ ] `preventDefault` solo en las 5 teclas del juego; el resto del teclado no se toca.
- [ ] El motor no dibuja HUD ni overlays; todo el dibujo es vector-neón (`fillRect`/`arc` + `shadowBlur`), sin imágenes.

---

## Riesgos

| Riesgo                                                                        | Mitigación                                                                                                            |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Estado infinito crece sin límite (filas/entidades) → memoria y GC.            | Ventana deslizante: solo se materializan filas en `[cameraRow-4, cameraRow+18]`; las viejas se descartan.             |
| Movimiento dependiente del refresco (120 Hz vs 60 Hz).                        | Física por `dt` real con clamp de 50 ms; velocidades en px/s, no px/frame.                                            |
| Pasajes imposibles del generador.                                             | Invariantes duras: segura entre bloques, gap de placas 2–4, largo 2–4; carriles circulares (densidad constante).      |
| Arrastre de placa + salto simultáneo produce posiciones fuera de celda.       | El salto lateral parte de `round(x/40)`; la x continua solo existe montado en placa.                                  |
| Parpadeo durante la animación de salto corrompe la posición.                  | `tryBlink` solo desde estado idle o encolado tras el hop en curso (mismo buffer de 1 input).                          |
| `dt` acumulado en pausa hace saltar coches/marea al reanudar.                 | `setPaused(false)` resetea `lastTime`; `update` no corre en pausa (patrón specs 05/07/08).                            |
| Doble `onGameOver` (marea + coche en el mismo frame, o FIN forzado + muerte). | Flag `gameOverEmitted`; `killPlayer` es no-op si `!alive` o `gameOverEmitted`.                                        |
| Glow (`shadowBlur`) en muchas entidades degrada el rendimiento.               | Glow solo en jugador, orbes y borde de la marea; coches/placas con glow bajo (≤ 8) y un solo `save/restore` por capa. |
