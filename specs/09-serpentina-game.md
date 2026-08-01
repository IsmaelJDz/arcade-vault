# SPEC 09 — Convertir SERPENTINA (`serpentina`) en juego real (Snake desde cero)

> **Contexto (por qué):** `serpentina` ya existe en el catálogo (`lib/games.ts`) y en el seed de
> `public.games` (Spec 06), pero hoy corre como **simulación falsa** (`SimulatedPlayer`) en
> `/play/serpentina`. Queremos que sea un juego jugable de verdad, como `rocas`/`caida`/`bloque-buster`.
> **Desviación respecto al flujo normal de `/add-game`:** no hay `game.js` en `references/started-games/`,
> así que el motor **se construye desde cero** (no es un port). Solo contamos con un spritesheet de frutas
> (`references/source-assets/snake-assets/fruits.png` + `sprites.js` con el atlas de recortes). Snake usará
> esos sprites para la comida, lo que lo convierte en **el primer juego del repo que usa `drawImage`**
> (los 8 actuales dibujan por vectores).

- **Estado:** Implementado
- **Depende de:** `01-visual-screens-app-router.md` (reproductor `/play/[id]`, `PlayerHud`, `saveScore`,
  `GAMES`), `05-asteroids-game.md` (patrón de motor + wrapper + `Player`), `06-games-scores-leaderboard.md`
  (tablas `games`/`scores`, seed, Hall).
- **Fecha:** 2026-08-01
- **Objetivo:** Implementar el juego Snake desde cero en `lib/games/serpentina.ts` e integrarlo en
  `/play/serpentina` con HUD (score / longitud / nivel), comida basada en el spritesheet de frutas, pausa,
  fin de partida y guardado real en `scores`, reutilizando la fila `serpentina` ya sembrada en `games`.

---

## Decisiones ya cerradas con el usuario

1. **Comida = frutas variadas (sprites).** Se copia `fruits.png` a `public/games/serpentina/`; cada comida
   es una fruta **aleatoria** del atlas (22 tipos). Primer juego con `drawImage`.
2. **Bordes = morir al chocar** (Snake clásico; coincide con el copy).
3. **HUD = SCORE + LONGITUD + NIVEL**, una sola vida; la **velocidad sube** al subir de nivel.
4. **Copy actualizado a frutas** en `lib/games.ts` (y en el seed de `public.games` vía MCP).

---

## Alcance

### Dentro

- **Motor `lib/games/serpentina.ts` (nuevo)** — Snake desde cero. Contrato
  `initSerpentina(canvas, handlers) → { destroy, setPaused, restart }`. Grid interno fijo, dibuja solo el
  área de juego (grid + serpiente + fruta); **no** dibuja HUD ni overlay GAME OVER. Sin reinicio con Espacio.
- **Atlas de sprites inline** — las coordenadas de `fruits.png` (de `snake-assets/sprites.js`) se copian como
  un `const FRUIT_ATLAS` tipado dentro del motor (no se depende del global `window.SPRITE_ATLAS`). La imagen
  se carga con `new Image()` desde `/games/serpentina/fruits.png`.
- **Asset servido** — copiar `references/source-assets/snake-assets/fruits.png` a
  `public/games/serpentina/fruits.png` (mismo esquema que el audio de bloque-buster).
- **Wrapper React `app/play/[id]/serpentina-game.tsx` (nuevo)** — client `forwardRef` calcado de
  `asteroids-game.tsx`: `<canvas className="serpentina-canvas">` a resolución interna, `handlersRef` fresco,
  boot/destroy en `useEffect([])`, pausa por prop, `useImperativeHandle` expone `restart`.
- **`app/play/[id]/page.tsx` (modificado)** — branch `id === "serpentina"` → `<SerpentinaPlayer game={game}/>`;
  `SerpentinaPlayer` calcado de `AsteroidsPlayer` (usa `PlayerHud`/`PauseOverlay`/`CrtBottom`/`EndModal`,
  `saveScore({ game: "serpentina", score })`, SALIR → `/game/serpentina`). HUD muestra **longitud** en el slot
  central (prop `lines` de `PlayerHud`, reetiquetado a LONGITUD) y **nivel**.
- **`lib/games.ts` (modificado)** — actualizar `short`/`long` de `serpentina` a la temática de frutas.
- **Seed en `public.games` (MCP)** — `UPDATE` de `short`/`long` de la fila `serpentina` para no desincronizar
  DB ↔ array. **Sin cambio de esquema; sin migración; sin regenerar tipos.**
- **CSS `app/globals.css`** — añadir `.serpentina-canvas` (copia de `.asteroids-canvas`: absolute-fill,
  `object-fit:contain`, fondo negro). `.cover-snake` **ya existe** — no se toca.
- **Captura de teclado** — `preventDefault` solo de `ArrowLeft/ArrowRight/ArrowUp/ArrowDown` (y `Space` si se
  usa), solo mientras montado; removidos en `destroy`. Bloqueo de giro 180°.

### Fuera

- Portar otros juegos; controles táctiles; sonido; puntuación distinta por tipo de fruta (todas valen igual,
  la variedad es solo visual); frutas especiales/power-ups; dificultad configurable; mejor-score persistente
  extra; cambios de esquema en `scores`/`games`; tests; rediseño de la cover.

---

## Modelo de datos

**No introduce datos persistidos nuevos.** La fila `serpentina` ya existe en `public.games` (Spec 06) y
`scores` ya acepta inserciones vía `saveScore`. El único cambio en DB es un `UPDATE` de copy.

Contrato del motor:

```ts
export interface SerpentinaHandlers {
  onScore: (score: number) => void; // score acumulado (p.ej. +10 por fruta)
  onLength: (length: number) => void; // nº de segmentos de la serpiente
  onLevel: (level: number) => void; // sube cada N frutas; aumenta la velocidad
  onGameOver: (finalScore: number) => void; // choque con pared o con la propia cola
}

export interface SerpentinaControls {
  destroy: () => void; // cancela rAF, quita listeners, libera la imagen
  setPaused: (paused: boolean) => void; // congela el avance; sigue dibujando
  restart: () => void; // reinicia la partida completa
}

export function initSerpentina(
  canvas: HTMLCanvasElement,
  handlers: SerpentinaHandlers,
): SerpentinaControls;
```

`UPDATE` de copy en `public.games` (vía MCP `execute_sql`):

```sql
update public.games
set short = '<nuevo short frutas>',
    long  = '<nuevo long frutas>'
where id = 'serpentina';
```

Convenciones heredadas de 05/06: resolución interna fija escalada por CSS; callbacks solo en cambios (patrón
`emitChanges()` con `lastScore/lastLength/lastLevel/gameOverEmitted`); `setPaused` resetea el reloj al
reanudar; `destroy()` cancela rAF + listeners; el score guardado es el del state React al pulsar GUARDAR;
`player_name`/`user_id` los pone el provider.

**Parámetros de diseño del motor (sin fuente que portar, se fijan aquí):**

- Canvas interno **800×600**, celda **20px** → grid **40×30**.
- Avance por **ticks** (no por frame): intervalo base ~130 ms; baja con cada nivel (más rápido).
- Score **+10 por fruta**; **nivel +1 cada 5 frutas**; velocidad sube por nivel.
- Serpiente inicia con 3 segmentos al centro, dirección derecha; comer alarga 1 segmento.
- Fruta aparece en celda libre aleatoria con un sprite de fruta aleatorio del atlas.
- Prohibido el giro de 180° (no puede devorarse por invertir).

---

## Plan de implementación (`/add-game-impl 09`)

Cada paso deja el sistema compilando.

1. **Asset** — copiar `references/source-assets/snake-assets/fruits.png` →
   `public/games/serpentina/fruits.png`.
2. **Motor `lib/games/serpentina.ts`** — implementar Snake desde cero dentro de `initSerpentina`: estado local
   (serpiente, dirección, fruta, score, longitud, nivel, acumulador de tick), `FRUIT_ATLAS` inline, carga de
   imagen, loop rAF con acumulador de tiempo por tick, `draw()` (grid + serpiente vector + fruta con
   `drawImage`), colisiones (pared / cola), `emitChanges()`, listeners de teclado guardados para `destroy`,
   `setPaused`/`restart`, y limpieza de la imagen en `destroy`. Prueba: `npm run build`.
3. **Wrapper `app/play/[id]/serpentina-game.tsx`** — copiar el patrón de `asteroids-game.tsx`;
   `<canvas width={800} height={600} className="serpentina-canvas">`; handlers
   `onScore/onLength/onLevel/onGameOver`.
4. **Integración `app/play/[id]/page.tsx`** — importar `SerpentinaGame`/`SerpentinaGameHandle`; añadir branch
   `serpentina`; `SerpentinaPlayer` calcado de `AsteroidsPlayer` con estados `score/length/level/paused/over`,
   `PlayerHud` (LONGITUD en slot central, NIVEL), `EndModal`, `saveScore({ game:"serpentina", score })`.
5. **CSS `app/globals.css`** — añadir `.serpentina-canvas` (copia de `.asteroids-canvas`).
6. **Catálogo + seed** — actualizar `short`/`long` de `serpentina` en `lib/games.ts` y aplicar el mismo
   `UPDATE` en `public.games` vía MCP. Verificar con `select id, short from games where id='serpentina'`.
7. **Verificación** — `npm run build` + `npm run lint`; recorrido: Library muestra la tarjeta, Detalle carga,
   `/play/serpentina` es jugable (crece, muere al chocar, HUD real, pausa, JUGAR DE NUEVO reinicia), guardar
   score logueado inserta en `scores` y aparece en Hall.

---

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/play/serpentina` renderiza el juego real; otros ids siguen en `SimulatedPlayer`.
- [ ] Importar el motor no accede al DOM en nivel de módulo (todo dentro de `initSerpentina`).

**Jugabilidad y HUD**

- [ ] Flechas mueven la serpiente; no permite giro de 180°; sin scroll de la página.
- [ ] Comer una fruta: +10 score, +1 longitud, aparece nueva fruta (sprite aleatorio) en celda libre.
- [ ] Cada 5 frutas sube el nivel y aumenta la velocidad.
- [ ] Chocar con la pared o con la cola → game over.
- [ ] La fruta se dibuja desde `fruits.png` (`drawImage`); el juego **no** dibuja HUD ni GAME OVER.
- [ ] HUD refleja score/longitud/nivel reales; PAUSA congela y muestra overlay; FIN abre el modal.

**Fin, guardado y catálogo**

- [ ] Game over abre `EndModal`; logueado → GUARDAR inserta `{ game_id:"serpentina", score, ... }` en `scores`
      y se ve en Hall; invitado ve el aviso de iniciar sesión.
- [ ] JUGAR DE NUEVO reinicia limpio; SALIR → `/game/serpentina`.
- [ ] `short`/`long` de `serpentina` reflejan frutas y coinciden entre `lib/games.ts` y `public.games`.

**Escalado, input y limpieza**

- [ ] Canvas 800×600 escalado 4:3 dentro de `.crt-screen`, `object-fit:contain`.
- [ ] Al salir/desmontar: rAF cancelado, listeners removidos, imagen liberada — sin loops duplicados.

---

## Decisiones (elegido vs descartado)

- **Motor desde cero** (No: esperar un `game.js` en `references/started-games/` — no existe).
- **Comida con spritesheet de frutas, `drawImage`** (No: dibujar la comida por vectores como el resto).
- **Fruta aleatoria por spawn, mismo puntaje** (No: puntaje distinto por fruta — fuera de alcance).
- **Morir al chocar la pared** (No: wrap-around).
- **Una sola vida + LONGITUD/NIVEL en HUD, velocidad progresiva** (No: sistema de vidas).
- **Reusar fila `serpentina` existente + `UPDATE` de copy** (No: `INSERT` nuevo / cambio de esquema).
- **`.cover-snake` intacta** (No: rediseñar la portada por las frutas).
- **`preventDefault` acotado a flechas** (No: global).

---

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Primer juego con `drawImage`: la imagen puede no haber cargado al primer frame | Cargar `new Image()` en init; si `!img.complete`, dibujar un placeholder vectorial esa celda hasta `onload`. |
| Fuga de recursos al desmontar                                                  | `destroy()` cancela rAF, quita listeners y nulifica la ref de imagen (patrón de `bloque-buster.ts`).         |
| Movimiento por frame en vez de por tick → velocidad depende del refresco       | Acumulador de tiempo con intervalo de tick fijo por nivel; `dt` clamp.                                       |
| Giro de 180° instantáneo = auto-choque injusto                                 | Bloquear dirección opuesta a la actual; encolar solo un cambio por tick.                                     |
| DB ↔ array desincronizados tras editar copy                                    | Aplicar el mismo `UPDATE` en `lib/games.ts` y en `public.games`; verificar con `select`.                     |
| `preventDefault` mal acotado bloquea scroll global                             | Solo teclas del juego y solo mientras montado; removidos en `destroy`.                                       |
| `restart()` deja estado viejo                                                  | `restart` reinicia estado completo y reemite el HUD.                                                         |

---

## Verificación end-to-end (tras `/add-game-impl 09`)

1. `npm run build && npm run lint`.
2. `npm run dev` → `/games`: la tarjeta SERPENTINA aparece con copy de frutas.
3. `/game/serpentina`: Detalle carga desde DB; botón JUGAR → `/play/serpentina`.
4. Jugar: mover, comer (crece + sube score/longitud), subir de nivel (más rápido), morir al chocar pared/cola.
5. PAUSA/EN PAUSA; FIN abre modal; logueado → GUARDAR; ver la marca en `/hall`.
6. MCP: `select id, short, long from public.games where id='serpentina'` refleja el copy nuevo.
