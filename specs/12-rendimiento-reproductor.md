# SPEC 12 — Rendimiento del reproductor y de los motores

> **Estado:** Aprobado
> **Depende de:** `05-asteroids-game.md`, `07-caida-game.md`, `08-bloque-buster-game.md`, `09-serpentina-game.md`, `10-controles-tactiles.md`, `11-gamepad-mk2-apariencia.md`, `game-jam/frogger/*`
> **Fecha:** 2026-08-09
> **Objetivo:** Eliminar el input lag y el consumo excesivo de CPU/GPU en `/play/[id]` recortando el trabajo desperdiciado por frame en el chrome CSS y en los 5 motores canvas, sin cambiar el aspecto visual.

---

## Contexto — por qué existe esta spec

El síntoma reportado es **input lag** (el salto de la rana responde tarde) y **ventilador/batería** (el equipo trabaja de más aunque el juego parezca fluido). Ambos son síntomas de lo mismo: cada frame hace mucho más trabajo del necesario, los frames se alargan y el `requestAnimationFrame` siguiente —que es donde se lee el input— llega tarde.

La investigación encontró **tres causas independientes**, dos de ellas compartidas por los 5 juegos:

**A. El chrome CSS rompe el aislamiento de capas.** `app/layout.tsx:43-44` monta `.av-bg` y `.av-noise` en todas las rutas, incluida `/play/[id]`. Dos capas a pantalla completa usan `mix-blend-mode` (`globals.css:140` overlay, `globals.css:1136` multiply). Un blend mode obliga al compositor a re-mezclar la capa superior cada vez que algo debajo repinta — y debajo hay un canvas que repinta 60-120 veces por segundo. Además `.av-bg::before` (`globals.css:106`) anima `background-position` sobre una capa full-viewport con `transform: perspective()` y `mask-image`: animar `background-position` es un **repaint** de esa capa en cada frame, no una animación compositada.

**B. Los motores dibujan el doble de frames en pantallas de 120 Hz.** Los 5 loops llaman a `requestAnimationFrame` sin cap. En un MacBook con ProMotion eso son 120 draws por segundo. La lógica ya es dt-based, así que el juego **no se juega distinto**: es exactamente el doble de trabajo tirado a la basura. Esta es la causa directa del ventilador.

**C. Cada motor desperdicia trabajo dentro del propio `draw()`.** En Frogger (`lib/games/frogger.ts:803`) todo el fondo estático —zonas, líneas de carril con `setLineDash`, las 5 bocas con `roundRect`+`stroke`— se reconstruye desde cero cada frame, y las ~35 entidades se dibujan como vectores (`roundRect`/`arc`/`ellipse`), unas 200-300 operaciones de path por frame para un contenido que apenas cambia. En `asteroids.ts`, `bloque-buster.ts` y `serpentina.ts` el problema es otro y peor: usan `shadowBlur` por trazo (`asteroids.ts:114`, `bloque-buster.ts:398`, `serpentina.ts:312`), que fuerza a Skia a un pase de desenfoque completo por cada elemento dibujado.

El resultado esperado: mismo aspecto pixel a pixel, la mitad de frames en pantallas rápidas, y frames mucho más cortos → el input se lee antes.

---

## Alcance

### Dentro

- **Chrome CSS (`app/globals.css`)** — sustituir las técnicas caras por equivalentes visuales baratas: scanlines sin `mix-blend-mode`, rejilla de fondo animada por `transform` en vez de `background-position`, y aislamiento explícito de la capa del canvas.
- **Módulo compartido nuevo `lib/games/engine.ts`** — loop con cap a 60 fps, `dt` acotado y normalizado, gestión de `paused`/`destroyed`/`rafId`, y creación del contexto 2D opaco. Consumido por los 5 motores.
- **Los 5 motores de `lib/games/`** — adoptar `engine.ts` y eliminar su loop propio.
- **`lib/games/frogger.ts`** — pre-renderizado del fondo estático y de los sprites de entidades; corrección del consumo de input.
- **`lib/games/asteroids.ts`, `bloque-buster.ts`, `serpentina.ts`** — sustituir `shadowBlur` por trazo por glow pre-renderizado en sprites cacheados.
- **Overlay de FPS de debug** — componente nuevo activable por query param en `/play/[id]`, para que los criterios de aceptación sean medibles.

### Fuera (para futuras specs)

- **Escalado por `devicePixelRatio`.** El canvas seguirá con su resolución interna actual estirada por CSS. Subir a DPR nativo multiplica por 4 los píxeles a rellenar en Retina — va en contra del objetivo de esta spec. La nitidez es otra spec si molesta.
- **Cambiar `HOP_MS` de Frogger** (120 ms) ni ninguna otra constante de dificultad o feel. Esta spec no toca el balance de ningún juego.
- **Degradar efectos durante la partida** (congelar la rejilla, bajar el ruido en `/play`). Se descartó a favor de mantener el aspecto y cambiar la técnica.
- **`OffscreenCanvas` en un Web Worker.** El pre-renderizado usa canvas fuera de pantalla en el hilo principal, no workers.
- **El cálculo `max-width: calc((100dvh - 372px) * 4 / 3)` de `.crt`** (`globals.css:1102`). `dvh` provoca relayout cuando la barra de URL móvil aparece o desaparece, pero es un problema de layout, no del bucle de render.
- **`app/play/[id]/page.tsx` como estructura.** Solo se le añade el montaje del overlay de debug; los 5 componentes `*Player` no se refactorizan ni se memoizan.
- **`SimulatedPlayer`** y su `setInterval` de puntos falsos.
- **La capa `.av-noise`.** Es un data-URI SVG estático que se rasteriza una vez; no participa en el coste por frame.

---

## Modelo de datos

Esta feature **no introduce datos persistidos** — ni DB, ni `localStorage`, ni cambios en `lib/supabase/types.ts`. Lo único nuevo son dos contratos internos.

**1. El contrato del loop compartido** (`lib/games/engine.ts`):

```ts
export interface GameLoop {
  start: () => void;
  stop: () => void;
  setPaused: (paused: boolean) => void;
  resetClock: () => void; // tras reanudar o reiniciar, para no acumular el tiempo parado
}

// dtMs llega ya acotado (≤ CLAMP_MS) y normalizado a un frame de 60 fps.
export function createGameLoop(onFrame: (dtMs: number) => void): GameLoop;

// Contexto 2D opaco: el fondo de los 5 juegos ya es opaco, declararlo
// ahorra la mezcla alfa por frame en la composición.
export function getGameContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D;
```

**2. La caché de sprites pre-renderizados**, local a cada motor. En Frogger la clave se compone del estado visual que distingue a una entidad:

```ts
// lib/games/frogger.ts — cachés reconstruidas solo al cambiar de skin.
let backdrop: HTMLCanvasElement | null = null; // zonas + carriles + bocas vacías
const sprites = new Map<string, HTMLCanvasElement>(); // clave: `${type}:${width}:${tint}:${dir}:${submerged}`
```

Convenciones:

- El cap de framerate es una constante única en `engine.ts`: `const MIN_FRAME_MS = 1000 / 60 - 1.5`. La holgura de 1.5 ms evita descartar frames legítimos en pantallas de 60 Hz por jitter del reloj.
- `dtMs` se normaliza contra `1000 / 60`, no contra el `16` literal que hoy usa `frogger.ts:513` y que hace correr el juego un ~4 % rápido.
- El overlay de debug **no usa estado de React**: escribe en el DOM por `ref`. Un `setState` por frame reintroduciría justo el coste que la spec elimina.

---

## Plan de implementación

Cada paso deja la app compilando y los 5 juegos jugables.

1. **Overlay de FPS de debug.** Crear `app/play/[id]/fps-overlay.tsx` (`"use client"`): un `rAF` propio que acumula fps instantáneos, media móvil de 1 s, p95 de ms/frame y contador de frames largos (>20 ms), escritos con `ref.textContent`. Se monta en los 5 `*Player` de `page.tsx` y se activa leyendo `window.location.search` dentro de un `useEffect` — **no** con `useSearchParams`, que obligaría a un `<Suspense>` y forzaría render en cliente de la ruta entera. **Prueba:** `/play/frogger?debug=fps` muestra el contador; sin el param no se monta nada.

2. **Baseline medido.** Con el overlay puesto, anotar en la spec las cifras de partida de los 5 juegos (fps medio, p95 de ms/frame, frames largos por minuto) en el equipo del usuario. **Prueba:** las cifras quedan escritas en la sección "Baseline" de la spec.

3. **Scanlines del CRT sin blend.** En `globals.css:1130` quitar `mix-blend-mode: multiply` de `.crt-screen::after`. El resultado es **matemáticamente idéntico**: mezclar en multiply con negro puro a α=0.18 da `0.82 × fondo`, exactamente lo mismo que componer negro normal a α=0.18. Añadir `isolation: isolate` a `.crt-screen` y `contain: paint`. **Prueba:** captura antes/después del CRT sin diferencia de píxeles; el overlay marca menos ms/frame.

4. **Scanlines del fondo sin blend.** En `globals.css:130` quitar `mix-blend-mode: overlay` de `.av-bg::after` y compensar el alfa del blanco para igualar el resultado sobre el fondo oscuro del tema. **Prueba:** captura antes/después de `/games` y `/play/frogger` visualmente equivalente.

5. **Rejilla de fondo animada por transform.** En `globals.css:106` mover la textura de la rejilla a una capa interna que se anima con `transform: translateY(60px)` en vez de `background-position`, dejando la `perspective`/`rotateX` en el contenedor. Añadir `will-change: transform`. **Prueba:** la rejilla se desplaza igual que antes; en el panel Layers de DevTools deja de repintarse cada frame.

6. **Promoción de la capa del canvas.** Añadir a las 5 clases `.<slug>-canvas` de `globals.css:1240-1292` la promoción a capa propia (`transform: translateZ(0)`), para que cada frame sea una subida de textura y no un repaint del árbol que hay encima. **Prueba:** los 5 juegos se ven igual; el canvas aparece como capa propia en DevTools.

7. **`lib/games/engine.ts`.** Crear el módulo con `createGameLoop` (cap a 60 fps por `MIN_FRAME_MS`, `dt` acotado y normalizado, `paused`/`destroyed`/`rafId`, `resetClock`) y `getGameContext` (contexto con `{ alpha: false }`). Ningún motor lo usa todavía. **Prueba:** `npm run build` verde.

8. **Frogger adopta `engine.ts`.** Sustituir el loop de `frogger.ts:818-836` y el `getContext` de la línea 317 por el módulo. Corregir `dtMs / 16` → normalización contra `1000/60` en las líneas 513 y 562. **Prueba:** Frogger jugable, el overlay marca ~60 fps estables incluso en pantalla de 120 Hz.

9. **Los otros 4 motores adoptan `engine.ts`.** Mismo cambio en `asteroids.ts`, `bloque-buster.ts`, `caida.ts` y `serpentina.ts`, borrando sus loops propios. **Prueba:** los 4 jugables e idénticos; ninguno supera 60 fps en el overlay.

10. **Input de Frogger sin frame perdido.** En `frogger.ts:527` el `if (!frog.animating && pendingDir) … else if (frog.animating)` hace que, al terminar un salto, la dirección encolada no se consuma hasta el frame siguiente. Reordenar para que el salto se resuelva y el input pendiente se consuma **en el mismo frame**, y permitir encolar una dirección durante la animación en curso. Sin tocar `HOP_MS`. **Prueba:** encadenar 4 flechas rápidas produce 4 saltos sin pérdidas ni pausa perceptible entre ellos.

11. **Fondo estático de Frogger pre-renderizado.** Extraer `drawZones` + `drawGoals` (la parte vacía) a un canvas fuera de pantalla generado una vez por skin, y en `draw()` volcarlo con un solo `drawImage`. Regenerar en `setSkin`. Las bocas ocupadas y la barra de tiempo siguen dibujándose en vivo encima. **Prueba:** Frogger idéntico; cambiar de skin en caliente actualiza el fondo.

12. **Sprites de entidades de Frogger.** Pre-renderizar coche/camión/tronco/tortuga a canvas cacheados por clave `${type}:${width}:${tint}:${dir}:${submerged}` y sustituir los paths de `drawLanes` por `drawImage`. Vaciar la caché en `setSkin`. **Prueba:** las entidades se ven idénticas; el overlay marca menos ms/frame que en el paso 11.

13. **Glow pre-renderizado en los otros 3 motores.** En `asteroids.ts`, `bloque-buster.ts` y `serpentina.ts` sustituir `shadowBlur`/`shadowColor` por trazo por sprites con el glow ya horneado, cacheados por color y radio. La `glow` de cada paleta sigue controlando la intensidad. **Prueba:** los 3 juegos lucen igual en las 3 skins; el overlay marca menos ms/frame.

14. **Verificación final.** `npm run build` + `npm run lint`; recorrido de los 5 juegos en las 3 skins, con teclado y con gamepad táctil emulado; comparación contra el baseline del paso 2.

---

## Baseline

Se rellena en el paso 2, antes de optimizar nada. Sin estas cifras los criterios de aceptación de rendimiento no son verificables.

| Juego           | fps medio | p95 ms/frame | Frames >20 ms por minuto |
| --------------- | --------- | ------------ | ------------------------ |
| `frogger`       | —         | —            | —                        |
| `rocas`         | —         | —            | —                        |
| `caida`         | —         | —            | —                        |
| `bloque-buster` | —         | —            | —                        |
| `serpentina`    | —         | —            | —                        |

Equipo y condiciones de medida (modelo, refresco de pantalla, navegador, build de producción) se anotan junto a la tabla.

---

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] Los 5 motores importan `lib/games/engine.ts` y ninguno conserva su propio `requestAnimationFrame`.
- [ ] Ningún motor usa `shadowBlur` en el camino de dibujo por frame.
- [ ] Sin el query param `?debug=fps`, el overlay no se monta ni ejecuta ningún `rAF`.

**Rendimiento (medido con el overlay, build de producción)**

- [ ] En una pantalla de 120 Hz, los 5 juegos marcan ~60 fps y no más: el cap está activo.
- [ ] El p95 de ms/frame de `frogger` baja al menos un 40 % respecto al baseline del paso 2.
- [ ] El p95 de ms/frame de `rocas`, `bloque-buster` y `serpentina` baja al menos un 30 % respecto al baseline.
- [ ] Los 5 juegos registran menos frames >20 ms por minuto que en el baseline.
- [ ] `grep -n "mix-blend-mode" app/globals.css` no devuelve ninguna coincidencia en `.av-bg::after` ni en `.crt-screen::after`.

**Sin regresión visual**

- [ ] Capturas antes/después del CRT en los 5 juegos y las 3 skins sin diferencia perceptible.
- [ ] Las scanlines del televisor y del fondo siguen visibles con la misma densidad e intensidad.
- [ ] La rejilla de perspectiva del fondo sigue desplazándose al mismo ritmo y en el mismo sentido.
- [ ] Cambiar de skin en caliente en los 5 juegos actualiza todos los colores, incluidos fondo y sprites cacheados.
- [ ] El glow de nave, bola, ladrillos y serpiente conserva su aspecto en las 3 skins.

**Sin regresión de jugabilidad**

- [ ] Los 5 juegos corren a la misma velocidad percibida que antes (la normalización de `dt` corrige el ~4 % de exceso de Frogger, que es el comportamiento correcto).
- [ ] En Frogger, encadenar 4 pulsaciones rápidas de dirección produce 4 saltos, sin ninguna pérdida.
- [ ] `HOP_MS` sigue en 120 ms y ninguna constante de dificultad cambia en ningún juego.
- [ ] PAUSA congela el motor y REANUDAR no produce un salto de tiempo acumulado.
- [ ] El gamepad táctil (specs 10/11) sigue funcionando igual en los 5 juegos.

---

## Decisiones (elegido vs descartado)

- **Sí: cap de render a 60 fps en los 5 motores.** Es la palanca más directa contra el consumo: en ProMotion/120 Hz corta a la mitad el trabajo sin cambiar nada jugable, porque la lógica ya es dt-based. (**No:** dejar 120 fps y confiar en abaratar el frame — el consumo seguiría siendo el doble. **No:** cap configurable — una decisión más que mantener por juego, sin beneficio claro.)
- **Sí: mantener el aspecto y cambiar la técnica.** El look neon-arcade es la identidad del producto. (**No:** degradar efectos durante la partida — cambio visible justo cuando el usuario está mirando. **No:** aspecto intocable pixel a pixel sin tocar CSS — dejaría fuera la causa raíz principal.)
- **Sí: quitar `mix-blend-mode` de las dos capas de scanlines.** En `.crt-screen::after` el cambio es demostrablemente sin pérdida: multiply con negro puro a α=0.18 y source-over con negro a α=0.18 dan ambos `0.82 × fondo`. (**No:** conservar el blend y compensar con otras optimizaciones — el blend es precisamente lo que impide aislar la capa del canvas.)
- **Sí: no tocar `devicePixelRatio`; solo declarar el contexto opaco con `alpha: false`.** Subir a DPR nativo cuadruplica los píxeles a rellenar en Retina, que es exactamente el síntoma reportado. (**No:** escalar a DPR con techo en 2× — mejora la nitidez a costa de empeorar el objetivo de la spec.)
- **Sí: módulo compartido `lib/games/engine.ts`.** Los 5 motores repiten el mismo loop; arreglarlo 5 veces garantiza que el sexto juego vuelva a nacer con el problema. (**No:** parche in-situ por motor — diff más pequeño hoy, deuda repetida mañana.)
- **Sí: pre-renderizar a canvas fuera de pantalla en el hilo principal.** El coste de generar los sprites se paga una vez por skin. (**No:** `OffscreenCanvas` en un Web Worker — complejidad desproporcionada para el tamaño del problema.)
- **Sí: corregir el input de Frogger consumiendo la dirección en el mismo frame, con buffer.** Elimina un frame de latencia sin tocar el feel. (**No:** bajar `HOP_MS` a 90 ms — alteraría la dificultad, y esta spec no toca balance.)
- **Sí: overlay de FPS por `window.location.search` en un `useEffect`.** (**No:** `useSearchParams` — en el App Router obliga a un `<Suspense>` y fuerza render en cliente de la ruta entera, un coste real en producción por una herramienta de debug.)
- **Sí: overlay que escribe en el DOM por `ref`.** (**No:** overlay con `useState` — un `setState` por frame reintroduciría el coste que la spec elimina, y además falsearía la medición.)
- **Sí: normalizar `dt` contra `1000/60` en vez del `16` literal.** El literal hace correr Frogger un ~4 % rápido; corregirlo es parte del arreglo, no un cambio de balance.

---

## Riesgos

| Riesgo                                                                                                                                               | Mitigación                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quitar `mix-blend-mode: overlay` de `.av-bg::after` no es una equivalencia exacta (overlay sí depende del fondo, a diferencia de multiply con negro) | Paso 4 aislado y con captura antes/después; se ajusta el alfa del blanco hasta igualar el resultado sobre el fondo oscuro del tema, que es el único fondo real de la app. |
| El cap a 60 fps introduce jitter en pantallas de 60 Hz si descarta frames legítimos por jitter del reloj                                             | `MIN_FRAME_MS = 1000/60 - 1.5`: la holgura de 1.5 ms absorbe la variación de `performance.now()` sin dejar pasar frames de 120 Hz.                                        |
| Las cachés de sprites quedan obsoletas al cambiar de skin en caliente y el juego pinta con la paleta anterior                                        | `setSkin` invalida explícitamente `backdrop` y vacía el `Map` de sprites; hay un criterio de aceptación dedicado al cambio de skin en caliente en los 5 juegos.           |
| El glow pre-renderizado no reproduce exactamente el `shadowBlur` nativo y los juegos "pierden brillo"                                                | Los sprites se generan con el mismo `shadowBlur` una sola vez al construirlos, no por frame: el resultado es el mismo desenfoque, solo que horneado.                      |
| Tocar los 5 motores en los pasos 9 y 13 rompe un juego sin que se note hasta el final                                                                | Paso 8 migra solo Frogger y se verifica antes de tocar los otros 4; cada motor del paso 13 se prueba en las 3 skins por separado.                                         |
| El baseline se mide en un equipo distinto al que reporta el problema y los porcentajes de mejora no significan nada                                  | El paso 2 anota equipo, refresco de pantalla y navegador junto a las cifras, y se mide en build de producción, no en `next dev`.                                          |

---

## Lo que **no** entra en esta spec

- Escalado por `devicePixelRatio` / nitidez del canvas en Retina.
- Cambios de dificultad, velocidad o feel en cualquier juego, incluido `HOP_MS` de Frogger.
- El `calc((100dvh - 372px) * 4 / 3)` de `.crt` y el relayout que provoca la barra de URL móvil.
- Refactor o memoización de los 5 componentes `*Player` de `page.tsx`.
- `SimulatedPlayer` y su ticker de puntos falsos.
- `OffscreenCanvas` en Web Workers.
- La capa `.av-noise`.

Cada uno de ellos, si llega, va en su propia spec.

---

## Archivos que cambian

**Nuevos**

- `lib/games/engine.ts` — loop compartido con cap a 60 fps + contexto 2D opaco.
- `app/play/[id]/fps-overlay.tsx` — overlay de debug activado por `?debug=fps`.

**Modificados**

- `app/globals.css` — `.crt-screen::after` (l. 1130), `.av-bg::after` (l. 130), `.av-bg::before` (l. 106), `.crt-screen` (l. 1120) y las 5 clases `.<slug>-canvas` (l. 1240-1292).
- `lib/games/frogger.ts` — loop, contexto, normalización de `dt`, consumo de input, pre-renderizado de fondo y sprites.
- `lib/games/asteroids.ts`, `lib/games/bloque-buster.ts`, `lib/games/serpentina.ts` — loop, contexto y glow pre-renderizado.
- `lib/games/caida.ts` — loop y contexto.
- `app/play/[id]/page.tsx` — montaje del overlay en los 5 `*Player`.

**Sin cambios**

- Los 5 wrappers `app/play/[id]/<slug>-game.tsx`.
- `app/play/[id]/touch-controls.tsx`.
- `lib/games/skins.ts` y las paletas de cada motor.
- Todo lo relacionado con Supabase, catálogo y leaderboard.

---

## Verificación de extremo a extremo

1. `npm run build && npm run lint` — ambos verdes.
2. `npm run build && npm start` (build de producción, **no** `next dev`: el modo desarrollo distorsiona la medición).
3. Abrir `/play/frogger?debug=fps` y jugar una ronda completa; anotar fps medio, p95 y frames largos. Repetir en `/play/rocas`, `/play/caida`, `/play/bloque-buster` y `/play/serpentina`.
4. Comparar contra la tabla de baseline del paso 2 y comprobar los umbrales de los criterios de aceptación.
5. En cada juego, recorrer las 3 skins (CLÁSICO / NEÓN / RETRO) verificando que el cambio en caliente actualiza fondo, sprites y glow.
6. Comparar capturas antes/después del CRT y del fondo de `/games` para descartar regresión visual.
7. En emulación táctil, comprobar que el gamepad de las specs 10/11 sigue respondiendo igual en los 5 juegos.
8. En Frogger, encadenar 4 pulsaciones rápidas de dirección y verificar que se producen 4 saltos.
