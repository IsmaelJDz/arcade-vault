# SPEC 06 — Tabla de juegos y leaderboard reales en Supabase

> **Estado:** Implementado
> **Depende de:** `01-visual-screens-app-router.md` (Biblioteca, Detalle, Hall, `saveScore`, `GAMES`), `04-supabase-auth.md` (sesión Supabase + clientes `lib/supabase/*` + `proxy.ts`), `05-asteroids-game.md` (`rocas` es el único juego que genera scores reales).
> **Fecha:** 2026-07-27
> **Objetivo:** Persistir el catálogo de juegos y las puntuaciones en Postgres (Supabase) con RLS, sembrando `games` desde el array `GAMES` actual y reemplazando el mock `seededScores` por un Salón de la Fama alimentado por scores reales, de modo que Biblioteca, Detalle y Hall lean desde la base de datos y `saveScore` inserte en DB (solo usuarios autenticados).

Notas de contexto:

- **Proyecto Supabase**: `eqsknyiewfyggpatpfcs`, operado vía MCP (`apply_migration`, `execute_sql`, `generate_typescript_types`).
- **Arranque de cero**: no se migra `av_scores`; el `localStorage` de scores se elimina.
- **Un solo juego real**: solo `rocas` produce scores; los demás juegos muestran leaderboard vacío (empty state).
- **Lectura**: server components hacen fetch y pasan datos a client components (que conservan búsqueda/tabs/tilt).
- **Fuera**: realtime, fila "tu mejor marca" en vivo, `best` en vivo en tarjetas, panel admin, portar otros juegos.

---

## Alcance

**Dentro:**

- **Esquema DB (migración vía MCP `apply_migration`)** — dos tablas en `public`:
  - `games` — catálogo persistido. PK = **slug de texto** (`rocas`, `caida`, …), sembrado desde el array `GAMES` con las mismas columnas (`title`, `short`, `long`, `cat`, `cover`, `color`, `best`, `plays`). `best`/`plays` son **columnas estáticas** sembradas (no se recalculan aquí).
  - `scores` — puntuaciones reales. `{ id uuid, game_id text → games.id, user_id uuid → auth.users, player_name text (copia del display_name al insertar), score int, created_at timestamptz }`.
- **RLS** — `games`: lectura pública (anon + auth), sin escritura desde la app. `scores`: lectura pública (leaderboard visible para invitados) e **insert propio** (`auth.uid() = user_id`); sin update/delete desde la app.
- **Seed de `games`** — insertar los 8 juegos actuales dentro de la migración (o seed inmediato), a partir de los valores de `lib/games.ts`.
- **Tipos** — generar tipos TS vía MCP (`generate_typescript_types`) para tipar las lecturas.
- **`lib/games.ts`** — conserva la interfaz `Game`/tipos y el array `GAMES` **solo como fuente del seed**; el runtime deja de leer del array. Se añaden helpers de lectura DB (o un `lib/scores.ts` para el leaderboard).
- **`app/games/page.tsx` (Biblioteca)** — pasa a server component que hace fetch de `games` y delega la UI interactiva (búsqueda, chips, tilt) a un client child.
- **`app/game/[id]/page.tsx` (Detalle)** — lee el juego desde `games` por id (server), con `notFound()` si no existe.
- **`app/hall/page.tsx` (Salón de la Fama)** — reemplaza `seededScores` por scores reales agrupados por juego; podio (top 3) + tabla (top N) desde DB; **empty state** para juegos sin scores. Se **elimina** la fila mock "TU MEJOR MARCA" (diferida).
- **`app/session-provider.tsx`** — `saveScore` pasa a **insert async en DB** con `user_id = auth.uid()` y `player_name = user.name`; solo autenticados. Se elimina toda la lógica `av_scores`/`localStorage`.
- **`app/play/[id]/page.tsx`** — el modal de FIN usa el `saveScore` async; para **invitado** muestra "inicia sesión para guardar tu marca" en vez de guardar.

**Fuera de alcance (specs futuras):**

- **Realtime** en el Hall — se refresca al recargar/navegar, no en vivo.
- **Fila "tu mejor marca"** del usuario en el Hall — se quita por ahora.
- **`best`/`plays` en vivo** en las tarjetas — siguen siendo columnas estáticas sembradas.
- **Panel admin / CRUD de juegos** — `games` se siembra por migración, no se edita desde la app.
- **Portar los otros 7 juegos** — siguen en simulación; solo `rocas` genera scores.
- **Migrar `av_scores`** — se arranca de cero.
- **Tests** (no hay runner) y rediseño de CSS.

---

## Modelo de datos

Dos tablas nuevas en `public`. Los ids de `games` son los **slugs** actuales (usados ya en rutas `/game/rocas` y en `saveScore({ game: "rocas" })`), así que se conservan como PK de texto.

**`public.games`** — catálogo persistido (sembrado desde `lib/games.ts`):

```sql
create table public.games (
  id     text primary key,          -- slug: 'rocas', 'caida', …
  title  text not null,
  short  text not null,
  long   text not null,
  cat    text not null,             -- 'ARCADE' | 'PUZZLE' | 'SHOOTER' | 'VERSUS'
  cover  text not null,             -- clase CSS de portada, p.ej. 'cover-rocas'
  color  text not null,             -- 'cyan' | 'magenta' | 'yellow' | 'green'
  best   integer not null default 0,-- columna estática sembrada
  plays  text not null default '0', -- texto tipo '15.6K', estático sembrado
  sort   integer not null default 0 -- preserva el orden actual del array GAMES
);
```

**`public.scores`** — puntuaciones reales:

```sql
create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  player_name text not null,        -- copia de display_name al insertar (denormalizado)
  score       integer not null check (score >= 0),
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc, created_at asc);
```

**RLS:**

```sql
alter table public.games  enable row level security;
alter table public.scores enable row level security;

-- games: lectura pública, sin escritura desde la app
create policy "games_public_read" on public.games
  for select using (true);

-- scores: lectura pública (leaderboard visible para invitados)
create policy "scores_public_read" on public.scores
  for select using (true);

-- scores: cada usuario inserta solo sus propias filas
create policy "scores_insert_own" on public.scores
  for insert with check (auth.uid() = user_id);
```

**Convenciones:**

- **Sin update/delete** de `scores` desde la app (no hay policy) → las marcas son inmutables una vez guardadas.
- **`player_name` denormalizado**: se copia el `display_name` (mayúsculas, ≤10) en el insert; el Hall no necesita joins a `auth`/`user_metadata`. Si el usuario cambia su nombre luego, las marcas viejas conservan el de entonces (aceptado).
- **`game_id` con FK a `games`**: garantiza que solo se guardan scores de juegos existentes; `on delete cascade` limpia scores si se borra un juego.
- **Leaderboard por juego**: `select … where game_id = $1 order by score desc, created_at asc limit N` (top N; desempate por marca más antigua). El podio (top 3) sale del mismo query.
- **`best`/`plays` de `games`** son estáticos (sembrados desde los valores actuales); no se recalculan desde `scores` en esta spec.
- **Contrato de `saveScore` (provider)** pasa a async y gateado por sesión:

```ts
// solo autenticados; devuelve el resultado del insert
saveScore: (e: { game: string; score: number }) => Promise<{ ok: boolean; error?: string }>;
```

`player_name` y `user_id` los pone el provider desde la sesión (no se pasan desde el llamador → no se pueden falsear en el cliente).

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable. Antes de tocar routing/server components/params, leer la guía correspondiente en `node_modules/next/dist/docs/` (App Router, Server Components, data fetching) — es Next.js 16, con diferencias respecto a versiones anteriores.

1. **Esquema + RLS + seed (MCP `apply_migration`)** — crear `public.games` y `public.scores` con sus FKs, índice y policies RLS; en la misma migración sembrar los 8 juegos con los valores actuales de `lib/games.ts` (incluyendo `sort` para preservar el orden). **Prueba:** `list_tables` muestra ambas tablas; `execute_sql "select id, sort from games order by sort"` devuelve los 8 juegos en orden; `get_advisors` no reporta tablas sin RLS.

2. **Tipos generados** — `generate_typescript_types` (MCP) → guardar en `lib/supabase/types.ts`; tipar los clientes con `Database`. **Prueba:** `npm run build` compila usando los tipos generados.

3. **Helpers de lectura (`lib/games.ts` + `lib/scores.ts`)** — `lib/games.ts` conserva la interfaz `Game`/tipos y el array `GAMES` **solo como referencia del seed**; añadir helpers server-side: `getGames()`, `getGame(id)`, y en `lib/scores.ts` `getLeaderboard(gameId, limit)`. Todos usan `lib/supabase/server.ts`. **Prueba:** importarlos y llamarlos desde un server component temporal devuelve los datos de DB.

4. **Biblioteca server + client child (`app/games/page.tsx`)** — la página pasa a server component: `getGames()` y pasa el array a un nuevo client child (`library-client.tsx`) que conserva búsqueda, chips y tilt tal cual. **Prueba:** `/games` renderiza las 8 tarjetas leídas de DB; búsqueda y filtros siguen funcionando.

5. **Detalle desde DB (`app/game/[id]/page.tsx`)** — server component que llama `getGame(id)`; `notFound()` si no existe. Delega la parte interactiva a un client child si hace falta. **Prueba:** `/game/rocas` muestra los datos de DB; un id inexistente devuelve 404.

6. **`saveScore` async en DB (`app/session-provider.tsx`)** — reescribir `saveScore` como insert async (`user_id = auth.uid()`, `player_name = user.name`); solo autenticados (si `user === null` devuelve `{ ok:false }` sin insertar). Eliminar toda la lógica `av_scores`/`localStorage` y la constante `SCORES_KEY`. Actualizar la firma en el contexto. **Prueba:** logueado, un insert desde el reproductor crea una fila en `scores` (verificable con `execute_sql`); invitado no inserta.

7. **Reproductor: guardar gateado (`app/play/[id]/page.tsx`)** — el modal de FIN usa el `saveScore` async (estado enviando/éxito/error); para **invitado** muestra "inicia sesión para guardar tu marca" en vez del botón GUARDAR. **Prueba:** jugar `rocas` logueado → GUARDAR persiste en DB; como invitado aparece el aviso y no guarda.

8. **Salón de la Fama real (`app/hall/page.tsx`)** — server component que, por juego (tabs), llama `getLeaderboard(gameId, N)`; podio (top 3) + tabla (top N) desde DB; **empty state** ("sé el primero en dejar tu marca") para juegos sin scores. Eliminar `seededScores` del flujo y la fila mock "TU MEJOR MARCA". La parte interactiva (cambio de tab) va en un client child que recibe los datos o refetch por tab. **Prueba:** tras guardar en `rocas`, el Hall de `rocas` muestra la marca real; los otros juegos muestran empty state.

9. **Limpieza y verificación** — quitar `seededScores` de `lib/games.ts` si ya nadie lo usa (o marcarlo no usado); `npm run build` + `npm run lint` sin errores. Recorrido completo: Biblioteca (DB) → Detalle `rocas` (DB) → jugar → FIN → GUARDAR (logueado) → Hall muestra la marca real → recargar (persiste) → invitado no puede guardar → juego sin scores muestra empty state. **Prueba:** el recorrido pasa; `get_advisors` sin hallazgos críticos de seguridad.

Notas de conversión:

- Las páginas de datos son **server components** (fetch con `lib/supabase/server.ts`, cookies); la interactividad vive en client children.
- El `provider` sigue siendo client component; `saveScore` usa el browser client.
- La lectura pública (`games`/`scores`) funciona para invitados vía RLS `select using (true)`.

---

## Criterios de aceptación

**Esquema, RLS y seed**

- [x] Existen `public.games` y `public.scores` con las columnas, FKs e índice definidos.
- [x] RLS activo en ambas: `games` lectura pública; `scores` lectura pública + insert propio (`auth.uid() = user_id`); sin update/delete.
- [x] `get_advisors` no reporta tablas sin RLS ni hallazgos críticos de seguridad.
- [x] `games` está sembrada con los 8 juegos actuales, con `best`/`plays`/`sort` correctos y en el orden original.
- [x] `lib/supabase/types.ts` refleja el esquema y `npm run build` compila con esos tipos.

**Catálogo desde DB**

- [x] `/games` (Biblioteca) renderiza las 8 tarjetas leídas de `games` (no del array en runtime).
- [x] Búsqueda por nombre y filtros por categoría siguen funcionando en el client child.
- [x] `/game/rocas` muestra los datos del juego leídos de DB; un id inexistente devuelve 404.

**Guardado de puntuaciones**

- [x] Logueado, terminar una partida de `rocas` y pulsar GUARDAR inserta una fila en `scores` con `game_id="rocas"`, `user_id` = el del usuario, `player_name` = su `display_name` y el `score` real.
- [x] El insert respeta RLS: no se puede insertar con un `user_id` distinto al de la sesión.
- [x] Invitado (sin sesión): el modal de FIN muestra "inicia sesión para guardar tu marca" y **no** inserta nada.
- [x] Ya no existe ninguna escritura/lectura de `av_scores`/`localStorage` para scores en el código.

**Salón de la Fama real**

- [x] El Hall de `rocas` muestra las marcas reales de `scores` (podio top 3 + tabla top N), ordenadas por `score` desc y desempate por `created_at` asc.
- [x] Un juego sin scores muestra el empty state ("sé el primero…"), no filas mock.
- [x] La fila mock "TU MEJOR MARCA" ya no aparece.
- [x] El leaderboard es visible para invitados (lectura pública) sin iniciar sesión.
- [x] Tras guardar una marca y recargar/navegar al Hall, la marca aparece (persistencia real).

**Build y limpieza**

- [x] `npm run build` compila sin errores de TypeScript.
- [x] `npm run lint` pasa sin errores.
- [x] `seededScores` ya no alimenta ninguna vista (removido o sin usar).

---

## Decisiones

- **Sí:** Una sola spec combinada (tabla `games` + scores/leaderboard). Van acopladas: `scores` tiene FK a `games` y el Hall lee ambas.
  - **No:** Dos specs separadas. Más ida y vuelta para trabajo que comparte migración, FK y setup de DB.
- **Sí:** `games` en Postgres con la app leyendo desde DB (Biblioteca/Detalle/Hall). Fuente única de verdad del catálogo.
  - **No:** Tabla solo para la FK con la UI leyendo el array hardcodeado. Dejaría dos fuentes del catálogo desincronizables.
- **Sí:** PK de `games` = slug de texto (`rocas`, …). Ya se usa en rutas y en `saveScore`; cero traducción de ids.
  - **No:** PK uuid con slug aparte. Añadiría un mapeo innecesario y rompería las rutas actuales.
- **Sí:** `best`/`plays` como columnas estáticas sembradas. Las tarjetas se ven igual que hoy; el leaderboard real es fuente aparte.
  - **No:** `best` en vivo desde `scores`. Con 7 juegos sin scores mostraría 0/"sin marcas"; se difiere a otra spec.
- **Sí:** `player_name` denormalizado en `scores` (copia del `display_name` al insertar). El Hall lee sin joins; no hay tabla `profiles` (el nombre vive en `user_metadata`).
  - **No:** Solo `user_id` resolviendo el nombre aparte. `user_metadata` no es joineable cómodo en SQL para el leaderboard.
- **Sí:** Leaderboard solo con scores reales + empty state. Honesto; no mezcla datos falsos con reales.
  - **No:** Rellenar con `seededScores`. Confundiría marcas reales con mock.
- **Sí:** Arrancar de cero, sin migrar `av_scores`, y eliminar el guardado en `localStorage`. Los datos locales son efímeros/de prueba; simplifica el código.
  - **No:** Migrar `av_scores` al primer login o mantener `localStorage` como respaldo. Complejidad (dedupe, flag de migrado, dos fuentes) sin valor real.
- **Sí:** Lectura vía server components + client child. Patrón App Router; RLS pública sirve a invitados; la interactividad se conserva en el hijo.
  - **No:** Fetch en cliente con `useEffect`. Estados de carga extra y peor SSR.
- **Sí:** RLS con lectura pública y solo insert propio en `scores` (sin update/delete). Marcas inmutables; leaderboard público.
  - **No:** Escritura amplia o edición de marcas desde la app. Abriría manipulación del leaderboard.
- **Sí:** `saveScore` async y gateado por sesión; invitado ve "inicia sesión para guardar". Coherente con specs 04/05 (invitado no guarda).
  - **No:** Permitir nombre anónimo. Rompe la decisión previa y complica RLS.
- **Sí:** Realtime, fila "tu mejor marca", `best` en vivo, panel admin y portar otros juegos → fuera. Mantiene la spec acotada.
  - **No:** Meterlos aquí. Cada uno es alcance prestado; van en su propia spec.

---

## Riesgos

| Riesgo                                                                                                                               | Mitigación                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tabla sin RLS o policy demasiado abierta expone/permite escribir el leaderboard (manipulación de marcas).                            | RLS activo en ambas tablas desde la migración; `scores` solo permite insert propio (`auth.uid() = user_id`), sin update/delete; `get_advisors` verifica que no queden tablas sin RLS. |
| El insert de `scores` confía en `player_name`/`user_id` que vengan del cliente → un usuario falsea su nombre o el `user_id` de otro. | `user_id` y `player_name` los pone el provider desde la sesión, no el llamador; la policy `with check (auth.uid() = user_id)` bloquea insertar en nombre de otro.                     |
| El seed de `games` se desincroniza del array `GAMES` (valores distintos) y las tarjetas cambian de aspecto.                          | El seed se genera desde los valores actuales de `lib/games.ts` en la misma migración; criterio de aceptación compara los 8 juegos, `best`/`plays`/`sort` y el orden.                  |
| Server components leyendo Supabase mal configurados (cookies/SSR de Next 16) rompen el fetch o filtran sesión.                       | Reusar `lib/supabase/server.ts` de la spec 04 (patrón `@supabase/ssr` ya probado); leer la guía de data fetching en `node_modules/next/dist/docs/`.                                   |
| Al eliminar `av_scores`/`localStorage`, algún consumidor (reproductor/Hall) queda con referencia muerta y rompe el build.            | Paso de limpieza + `npm run build`/`lint`; se actualiza la firma de `saveScore` en el contexto para que TS marque cualquier llamador desactualizado.                                  |
| El Hall queda casi todo vacío (solo `rocas` tiene scores) y parece "roto" para el usuario.                                           | Empty state explícito y con copy ("sé el primero en dejar tu marca"); es el comportamiento honesto esperado, no un error.                                                             |
| `display_name` cambia luego y las marcas viejas muestran el nombre anterior (denormalizado).                                         | Aceptado por diseño: la marca refleja el nombre de cuando se logró; documentado en convenciones del modelo de datos.                                                                  |

---

## Lo que **no** entra en esta spec

- Realtime en el Hall (actualización en vivo del leaderboard).
- Fila "tu mejor marca" del usuario en el Hall.
- `best`/`plays` en vivo en las tarjetas (siguen estáticos sembrados).
- Panel admin / CRUD de juegos desde la app.
- Portar los otros 7 juegos (siguen en simulación).
- Migrar `av_scores` desde `localStorage`.
- Tests automatizados y rediseño de CSS.

Cada uno de estos, si llega, va en su propia spec.
