# SPEC centella/03 — Integración de CENTELLA en la plataforma

> **Estado:** Draft
> **Depende de:** `specs/game-jam/centella/01-game-design.md` (diseño e identidad de catálogo), `specs/game-jam/centella/02-engine.md` (contrato del motor), `specs/01-visual-screens-app-router.md` (reproductor, `PlayerHud`, `saveScore`), `specs/05-asteroids-game.md` (patrón wrapper + `Player`), `specs/06-games-scores-leaderboard.md` (tablas `games`/`scores`, `sort`, Hall)
> **Fecha:** 2026-08-02
> **Objetivo:** Integrar el motor de CENTELLA en `/play/centella` con wrapper, branch del reproductor, fila nueva en `public.games` + entrada en `GAMES`, CSS de cover/canvas y verificación end-to-end con guardado en el Hall.

---

## Alcance

**Dentro:** wrapper `app/play/[id]/centella-game.tsx`; branch `centella` en `app/play/[id]/page.tsx` (`CentellaPlayer`); `INSERT` en `public.games` vía MCP + entrada en `GAMES` de `lib/games.ts`; CSS `.cover-centella` y `.centella-canvas` en `app/globals.css`.

**Fuera:** cambios de esquema, migraciones o regeneración de tipos (agregar un juego es un `INSERT`, no una migración); tocar `PlayerHud`/`EndModal`/`PauseOverlay`; sonido; controles táctiles; tests (no hay runner).

---

## Wrapper `app/play/[id]/centella-game.tsx` (nuevo)

Client component `forwardRef`, calcado del patrón `asteroids-game.tsx`:

```ts
export interface CentellaGameHandle {
  restart: () => void;
}

interface CentellaGameProps {
  paused: boolean;
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

- `"use client"`; `canvasRef` + `controlsRef` + `handlersRef` refrescado en cada render (los callbacks del padre nunca quedan obsoletos).
- **Boot en `useEffect([])`**: llama `initCentella(canvasRef.current, proxyHandlers)` y **retorna `destroy`** como cleanup.
- **Pausa por prop**: `useEffect([paused])` → `controlsRef.current?.setPaused(paused)`.
- **`useImperativeHandle`** expone `restart` (delegado a `controlsRef.current.restart()`).
- Render: `<canvas width={800} height={600} className="centella-canvas" />`.

---

## Branch en `app/play/[id]/page.tsx` (modificado)

- `game.id === "centella"` → `<CentellaPlayer game={game} />`; los demás slugs no portados siguen en `SimulatedPlayer`.
- `CentellaPlayer` calcado de `AsteroidsPlayer` (variante **Vidas**):
  - Estado: `score / lives (3) / level (1) / paused / over / saveState`.
  - Reusa `PlayerHud` (PUNTOS / **VIDAS** con corazones vía prop `lives` / NIVEL), `PauseOverlay`, `CrtBottom`, `EndModal`.
  - PAUSA → prop `paused`; FIN → fuerza game over (abre el modal con el score actual); `onGameOver` → modal; JUGAR DE NUEVO → `ref.restart()` + reset de estado React; SALIR → `/game/centella`.
  - GUARDAR → `saveScore({ game: "centella", score })` (el provider pone `player_name`/`user_id`; invitado ve el aviso de iniciar sesión).
  - Leyenda de controles: `◄ ▲ ▼ ► SALTAR · ESPACIO PARPADEO` (reusa `.game-controls` / `.keyboard-notice`).

---

## Catálogo: DB + `lib/games.ts`

**`INSERT` en `public.games` vía MCP (`execute_sql`)** — sin migración, sin regenerar tipos:

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays, sort)
values (
  'centella',
  'CENTELLA',
  'Cruza la autopista infinita en un parpadeo.',
  'Una chispa fugada de la red huye por una autopista de datos sin fin. Esquiva el tráfico, cruza el río de plasma sobre placas a la deriva y teletranspórtate con tu parpadeo cuando no quede salida. La marea de estática nunca deja de subir.',
  'ARCADE',
  'cover-centella',
  'magenta',
  12600,
  '3.4K',
  9
);
```

**Entrada en `GAMES` (`lib/games.ts`)** — misma fila sin `sort` (referencia del seed, client-safe), al final del array:

```ts
{
  id: "centella",
  title: "CENTELLA",
  short: "Cruza la autopista infinita en un parpadeo.",
  long: "Una chispa fugada de la red huye por una autopista de datos sin fin. Esquiva el tráfico, cruza el río de plasma sobre placas a la deriva y teletranspórtate con tu parpadeo cuando no quede salida. La marea de estática nunca deja de subir.",
  cat: "ARCADE",
  cover: "cover-centella",
  color: "magenta",
  best: 12600,
  plays: "3.4K",
},
```

DB y array deben quedar **idénticos** en copy (verificar con `select id, short, sort from public.games where id = 'centella'`).

---

## CSS `app/globals.css`

- **`.centella-canvas`** — copia de `.asteroids-canvas`: absolute-fill dentro de `.crt-screen`, `object-fit: contain`, fondo negro (canvas 800×600, ratio 4:3, sin letterbox en el chrome estándar).
- **`.cover-centella`** — portada vector-neón al estilo de las `.cover-*` existentes (gradientes + `::after`/`::before`): fondo `#05060c` con bandas horizontales alternadas (carretera oscura / río cian profundo vía `repeating-linear-gradient`) y un rombo magenta `#ff3df0` con glow como pseudo-elemento (la centella cruzando).
- Reusar `.game-controls` / `.keyboard-notice` con la media query `(pointer: coarse)` — sin reglas nuevas para móvil.

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable. Antes de tocar routing/params, leer la guía de Next.js 16 en `node_modules/next/dist/docs/`.

1. **Motor** — implementar `lib/games/centella.ts` según `02-engine.md` (plan propio de 8 pasos).
   **Prueba:** `npm run build` compila; el import no toca el DOM.
2. **Wrapper `centella-game.tsx`** — patrón `asteroids-game.tsx` con el contrato de arriba.
   **Prueba:** el canvas monta, el juego corre con flechas + Espacio; desmontar no deja loop vivo.
3. **Branch en `page.tsx`** — `CentellaPlayer` con HUD Vidas y leyenda de controles.
   **Prueba:** `/play/centella` jugable con HUD real (score/vidas/nivel); otros slugs no portados siguen en `SimulatedPlayer`.
4. **CSS** — `.centella-canvas` + `.cover-centella` en `app/globals.css`.
   **Prueba:** canvas completo y proporcional (4:3) en distintos anchos; en móvil aparece "requiere teclado"; la cover se ve en la Biblioteca.
5. **Catálogo** — `INSERT` en `public.games` vía MCP + entrada en `GAMES`.
   **Prueba:** el `select` de verificación devuelve la fila con `sort = 9`; `/games` muestra la tarjeta CENTELLA al final; `/game/centella` carga desde DB.
6. **Verificación final** — `npm run build` + `npm run lint`; recorrido end-to-end completo (abajo).
   **Prueba:** el recorrido pasa; los juegos existentes (`rocas`, `caida`, `bloque-buster`, `serpentina`) siguen funcionando.

---

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `/play/centella` renderiza el juego real; los slugs no portados siguen en `SimulatedPlayer`.
- [ ] `lib/games/centella.ts` no accede al DOM al importarse.
- [ ] Fila `centella` en `public.games` (`sort = 9`) idéntica en copy a la entrada de `GAMES`; sin migración ni tipos regenerados.
- [ ] La Biblioteca muestra la tarjeta con `.cover-centella` (filtro ARCADE la incluye) y el Detalle carga desde DB.

**Jugabilidad y HUD**

- [ ] Flechas saltan por celdas; Espacio parpadea con cooldown de 5 s; sin scroll de la página.
- [ ] Coches, plasma, borde lateral y marea matan; orbes suman +50; fila récord +10; nivel sube cada 20 filas y acelera el juego.
- [ ] HUD React refleja PUNTOS / VIDAS (corazones) / NIVEL reales; el canvas no dibuja HUD ni overlays.
- [ ] PAUSA congela y muestra "EN PAUSA"; REANUDAR continúa sin salto de tiempo; FIN abre el modal con el score actual.

**Fin, guardado y Hall**

- [ ] Vidas a 0 abre `EndModal` con el score final (sin reinicio con Espacio).
- [ ] Logueado, GUARDAR inserta `{ game_id: "centella", user_id, player_name, score }` en `scores` y la marca aparece en el Hall (podio + tabla).
- [ ] Invitado ve "inicia sesión para guardar tu marca" y no inserta.
- [ ] JUGAR DE NUEVO reinicia limpio (mundo nuevo, 3 vidas, nivel 1); SALIR navega a `/game/centella`.

**Escalado, input y limpieza**

- [ ] Canvas 800×600 completo y proporcional (4:3) en distintos anchos; en móvil aparece el aviso "requiere teclado".
- [ ] Las 5 teclas del juego no hacen scroll; el resto del teclado del sitio no se ve afectado.
- [ ] Navegar fuera de `/play/centella` y volver no duplica loops ni listeners (cleanup del `useEffect` llama `destroy`).

---

## Decisiones (Sí / No)

- **Sí:** `INSERT` de fila nueva con `sort = 9` (juego nuevo del jam, no existe en el seed).
  - **No:** reusar un slug existente (07–09 lo hicieron porque su fila ya estaba sembrada; aquí no aplica).
- **Sí:** `GAMES` de `lib/games.ts` se actualiza en espejo con la DB.
  - **No:** solo DB (desincronizaría la referencia del seed y los tipos de dominio).
- **Sí:** `CentellaPlayer` calcado de `AsteroidsPlayer` (variante Vidas de `PlayerHud`).
  - **No:** crear un HUD nuevo o parametrizar más `PlayerHud` (Vidas ya existe y encaja).
- **Sí:** `.centella-canvas` copia de `.asteroids-canvas` (mismo 4:3, 800×600).
  - **No:** ratio propio (obligaría a letterbox y reglas CSS nuevas sin beneficio).
- **Sí:** Cover 100 % CSS (`.cover-centella` con gradientes + pseudo-elementos), como todas las covers.
  - **No:** imagen de portada (ninguna cover del catálogo usa assets).

---

## Riesgos

| Riesgo                                                       | Mitigación                                                                                                              |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| DB y `GAMES` desincronizados (copy o color distintos).       | Un solo bloque de copy fuente (esta spec); `select` de verificación tras el `INSERT`.                                   |
| `sort` duplicado o hueco rompe el orden de la Biblioteca.    | Verificar `select max(sort) from public.games` antes del `INSERT`; usar `max + 1` si ya no fuera 8.                     |
| El branch nuevo rompe los juegos ya portados en `page.tsx`.  | Branch aditivo al patrón existente; el recorrido final revisita `rocas`/`caida`/`bloque-buster`/`serpentina`.           |
| Callbacks obsoletos en el wrapper (closure viejo del padre). | `handlersRef` refrescado cada render (patrón `asteroids-game.tsx`).                                                     |
| Fuga de rAF/listeners al navegar fuera y volver.             | Cleanup del `useEffect([])` retorna `destroy`; criterio específico lo valida.                                           |
| La cover CSS desentona con el grid existente.                | Construirla con los mismos patrones (`repeating-linear-gradient` + `::after` con glow) de `.cover-rana`/`.cover-rocas`. |
| Guardado sin sesión o con slug erróneo.                      | `saveScore({ game: "centella", score })` exacto; invitado bloqueado por el provider (RLS además lo impide).             |
