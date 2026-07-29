# Plantilla de spec — Portar un juego + su leaderboard

> Estructura de referencia para la spec que produce `/add-game`. Combina el patrón de
> `specs/05-asteroids-game.md` (motor portado al reproductor) con el de
> `specs/06-games-scores-leaderboard.md` (fila en `games` de Supabase + Hall). Reemplaza
> `<Nombre>`/`<slug>` por los del juego. Escribe todo en español.

---

# SPEC NN — Portar el juego <Nombre> (`<slug>`) a la plataforma

> **Estado:** Draft
> **Depende de:** `01-visual-screens-app-router.md` (reproductor `/play/[id]`, sesión + `saveScore`, `GAMES`), `05-asteroids-game.md` (patrón de motor portado), `06-games-scores-leaderboard.md` (tablas `games`/`scores` + Hall).
> **Fecha:** YYYY-MM-DD
> **Objetivo:** (una sola frase) Portar el juego <Nombre> de `references/started-games/<carpeta>/` como juego real en `/play/<slug>`, con HUD, pausa, fin de partida y guardado en `scores`, y sembrarlo en el catálogo `games` para que aparezca en Biblioteca, Detalle y Salón de la Fama.

## Alcance

**Dentro:**

- **Motor `lib/games/<slug>.ts` (nuevo)** — port TS del `game.js` fuente: clases y lógica de
  loop/colisiones/niveles sin globals ni acceso al DOM al importar. Contrato:
  `init<Nombre>(canvas, handlers) → { destroy, setPaused, restart }`. El motor dibuja **solo el área
  de juego** (no el HUD ni el overlay de GAME OVER; los pinta React). Reinicio con Espacio
  desactivado.
- **Wrapper React `app/play/[id]/<slug>-game.tsx` (nuevo)** — client component (`forwardRef`) que
  monta el `<canvas>` a la resolución interna del juego, llama a `init<Nombre>`, cablea callbacks al
  HUD React, conecta PAUSA (`setPaused`), FIN (fuerza game over), JUGAR DE NUEVO (`restart`) y SALIR;
  limpia con `destroy()` al desmontar. Leyenda de controles en desktop, aviso "requiere teclado" en móvil.
- **`app/play/[id]/page.tsx` (modificado)** — branch `id === "<slug>"` → `<<Nombre>Player>`; los
  demás ids conservan la simulación. Reusa `PlayerHud`/`PauseOverlay`/`CrtBottom`/`EndModal`; adapta
  las etiquetas del HUD a los campos reales del juego.
- **Fila en `public.games` (seed vía MCP)** — `INSERT` con `{ id:"<slug>", title, short, long, cat,
cover:"cover-<slug>", color, best, plays, sort }`. Sin cambios de esquema.
- **`lib/games.ts` (modificado)** — entrada gemela en el array `GAMES` (aún lo lee `page.tsx`/Home).
- **CSS (`app/globals.css`)** — clase de portada `.cover-<slug>` y regla `.<slug>-canvas`
  (absolute-fill + `object-fit:contain`) reusando `.game-controls`/`.keyboard-notice`.
- **Captura de teclado** — `preventDefault` solo de las teclas del juego (<listar>) y solo mientras
  el motor está activo; listeners removidos en `destroy`.

**Fuera de alcance:**

- Portar otros juegos (siguen en simulación).
- Controles táctiles / móvil jugable (solo aviso "requiere teclado").
- <Assets extra: sonido / sprites / niveles — decidir por juego; sonido normalmente diferido>.
- Mejor score persistente, ranking en vivo, dificultad configurable.
- Realtime en el Hall, `best`/`plays` en vivo (siguen estáticos sembrados).
- Tests (no hay runner).

## Modelo de datos

**No introduce datos persistidos nuevos** más allá de una fila en `games`; `scores` ya existe y solo
recibe `INSERT` al jugar (vía `saveScore` de la spec 06). Agregar el juego **no** cambia el esquema
ni requiere regenerar `lib/supabase/types.ts`.

**Contrato del motor `lib/games/<slug>.ts`:**

```ts
interface <Nombre>Handlers {
  onScore: (score: number) => void;
  // Ajustar a los campos reales del juego, p. ej.:
  onLives: (lives: number) => void; // o onLines / onLevel …
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

interface <Nombre>Controls {
  destroy: () => void; // detiene el loop y quita listeners
  setPaused: (paused: boolean) => void; // congela update; sigue dibujando
  restart: () => void; // reinicia la partida (initGame)
}

function init<Nombre>(canvas: HTMLCanvasElement, handlers: <Nombre>Handlers): <Nombre>Controls;
```

**Fila a sembrar en `public.games`:**

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort)
values ('<slug>', '<title>', '<short>', '<long>', '<CAT>', 'cover-<slug>', '<color>', <best>, '<plays>', <sort>);
```

Convenciones (heredadas de 05/06):

- Canvas de resolución interna fija (la del juego); el escalado es solo CSS (aspect-ratio, letterbox).
- Callbacks disparados **en cambios**, no cada frame; `onGameOver` una sola vez.
- `setPaused(true)` salta `update(dt)` pero sigue dibujando; al reanudar se resetea `lastTime`.
- `destroy()` cancela el `requestAnimationFrame` y remueve listeners (indispensable en SPA).
- `player_name`/`user_id` los pone el provider desde la sesión; el llamador solo pasa `game`+`score`.
- Slug de texto como `id` en todo (rutas, `saveScore`).

## Plan de implementación

Cada paso deja el sistema compilando. Antes de tocar routing/params, leer la guía en
`node_modules/next/dist/docs/` (Next.js 16).

1. **Motor `lib/games/<slug>.ts`** — portar `game.js`: mover globals y clases dentro de
   `init<Nombre>`; usar el `ctx` del canvas recibido; registrar listeners en init y guardarlos para
   `destroy`; exponer `destroy/setPaused/restart`; quitar HUD/overlay dibujados y el reinicio con
   Espacio; emitir `onScore/…/onGameOver` en transiciones; `preventDefault` solo de las teclas del
   juego. Prueba: `npm run build` compila; el import no toca el DOM.
2. **Wrapper `app/play/[id]/<slug>-game.tsx`** — client `forwardRef`: `canvasRef`+`controlsRef`,
   `handlersRef` refrescado cada render, boot en `useEffect([])` que retorna `destroy`, pausa por
   prop, `useImperativeHandle` para `restart`. Prueba: monta el canvas y el juego corre con teclado.
3. **Integración en `app/play/[id]/page.tsx`** — branch `id === "<slug>"` → `<<Nombre>Player>`
   (modelo `AsteroidsPlayer`): estado real de HUD por callbacks; PAUSA→`setPaused`; FIN→game over;
   `onGameOver`→modal; GUARDAR→`saveScore({ game:"<slug>", score })`; JUGAR DE NUEVO→`restart`;
   SALIR→`/game/<slug>`. Prueba: `/play/<slug>` jugable con HUD real; otros ids siguen simulados.
4. **Seed en `public.games` (MCP)** — `execute_sql` (o `apply_migration`) con el `INSERT` de arriba;
   verificar con `select * from games where id='<slug>'`. Prueba: la fila existe con `sort` correcto.
5. **`lib/games.ts` + portada CSS** — agregar la entrada gemela en `GAMES` y la clase `.cover-<slug>`
   en `app/globals.css`. Prueba: la tarjeta se ve en Biblioteca/Detalle.
6. **CSS del canvas** — regla `.<slug>-canvas` (absolute-fill, `object-fit:contain`) reusando
   `.game-controls`/`.keyboard-notice` con la media query `(pointer: coarse)`. Prueba: canvas
   completo y proporcional; en móvil aparece el aviso.
7. **Verificación** — `npm run build` + `npm run lint` sin errores. Recorrido: Biblioteca → Detalle
   `<slug>` → JUGAR → jugar (HUD real sube/baja) → FIN/perder → modal → GUARDAR (logueado, persiste
   en `scores`) → Hall de `<slug>` muestra la marca → invitado no guarda. Prueba: el recorrido pasa.

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` compila sin errores; `npm run lint` pasa.
- [ ] `/play/<slug>` renderiza el juego real (canvas) en vez de la simulación.
- [ ] Otro id sigue mostrando la simulación falsa.
- [ ] `lib/games/<slug>.ts` no accede al DOM al importarse (solo dentro de `init<Nombre>`).

**Jugabilidad y HUD**

- [ ] Los controles del juego funcionan (<listar teclas>).
- [ ] El score/estado sube según las reglas del juego; el HUD React refleja el estado **real**.
- [ ] El juego **no** dibuja su HUD ni el overlay de GAME OVER en el canvas.
- [ ] PAUSA congela y muestra "EN PAUSA"; REANUDAR continúa sin salto de tiempo.
- [ ] FIN termina la partida y abre el modal con el score actual.

**Fin, guardado y catálogo**

- [ ] Terminar la partida abre el modal de FIN (no reinicia con Espacio).
- [ ] Logueado, GUARDAR inserta en `scores` `{ game_id:"<slug>", user_id, player_name, score }`.
- [ ] Invitado: el modal muestra "inicia sesión para guardar tu marca" y no inserta.
- [ ] Existe la fila en `public.games` con `best`/`plays`/`sort` correctos.
- [ ] `/games` (Biblioteca) y `/game/<slug>` (Detalle) muestran el juego leído de DB.
- [ ] El Hall de `<slug>` muestra las marcas reales (podio + tabla); vacío → empty state.

**Escalado, input y limpieza**

- [ ] El canvas se ve completo y proporcional en distintos anchos; en móvil aparece el aviso.
- [ ] Las teclas del juego no hacen scroll de la página mientras se juega.
- [ ] Al navegar fuera de `/play/<slug>` y volver, no se duplican loops ni listeners.

## Decisiones

- **Sí:** Motor como módulo TS con contrato `init<Nombre>(canvas, handlers) → { destroy, setPaused,
restart }`, sin globals. **No:** cargar `game.js` tal cual (globals + `document.getElementById`).
- **Sí:** HUD React alimentado por callbacks; el juego dibuja solo el área de juego. **No:** mantener
  el HUD dibujado en canvas.
- **Sí:** Game over → modal de FIN + `saveScore`; Espacio-reinicia desactivado. **No:** conservar el
  reinicio con Espacio del juego.
- **Sí:** Fila estática en `games` (`best`/`plays` sembrados). **No:** recalcular `best` desde
  `scores` (diferido).
- **Sí:** `<Assets extra>` — <portar / inline / diferir> con justificación.

## Riesgos

| Riesgo                                                             | Mitigación                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| No limpiar rAF/listeners al desmontar → loops/handlers duplicados. | `destroy()` cancela rAF y remueve listeners; el `useEffect` lo llama en cleanup.          |
| Acceso al DOM al importar el módulo → error SSR/build.             | Todo el DOM vive dentro de `init<Nombre>` (llamado desde `useEffect`, solo cliente).      |
| `preventDefault` mal acotado secuestra el teclado del sitio.       | Solo teclas del juego y solo mientras el motor está activo; removido en `destroy`.        |
| Desincronía score interno ↔ HUD/modal React.                       | El motor es la única fuente; React refleja callbacks; FIN provoca game over vía el motor. |
| El escalado CSS deforma el juego o desalinea colisiones.           | Colisiones en coordenadas internas fijas; el CSS solo escala con aspect-ratio.            |
| `restart()` deja estado viejo (balas, partículas, niveles).        | `restart` llama a `initGame` (reset completo), igual que el arranque.                     |

## Lo que **no** entra en esta spec

- Portar otros juegos del catálogo (siguen en simulación).
- Controles táctiles / móvil jugable.
- <Sonido / assets diferidos>.
- Realtime, mejor score persistente, ranking, dificultad configurable.
- Tests automatizados.
