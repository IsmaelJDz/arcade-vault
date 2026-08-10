# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Critical: Next.js version

Uses **Next.js 16.2.10** with **React 19** and **Tailwind CSS v4** — all newer than most training data and with breaking changes. Before writing framework/routing/config code, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `03-architecture`). Do not assume APIs from older Next.js.

No test runner is configured yet. Verify with `npm run build` + `npm run lint`.

## Skills

- Usa siempre **/frontend-design** para diseñar el frontend.
- **/add-game `<carpeta>`** + **/add-game-impl `NN`** — portar un juego nuevo (ver Workflow).
- Spec Driven Design vía **/spec** y **/spec-impl** para features generales.
- **/spec-impl-game `NN`** — igual que `/spec-impl` pero al terminar el plan dispara en secuencia `skin-designer` y luego `mobile-porter`.

## Agents

- **game-planner** (`.claude/agents/game-planner.md`) — planifica y decide qué juego encaja como próximo port. Úsalo cuando se pregunte qué juego agregar o para planear el roadmap de juegos. Mantiene memoria persistente de sugerencias en `.claude/agents/memory/game-planner.md` (nunca re-sugiere `rechazado`/`implementado`); su salida alimenta el workflow `/add-game`.
- **game-jam** (`.claude/agents/game-jam.md`) — dado un tema de jam, inventa un juego original y genera sus 3 specs Draft (`01-game-design.md`, `02-engine.md`, `03-integration.md`) en `specs/game-jam/<game-id>/` de forma automática. Úsalo cuando se dé un tema de game jam.
- **skin-designer** (`.claude/agents/skin-designer.md`) — audita que todos los juegos reales tengan las skins `clasico`/`neon`/`retro` (solo paleta del canvas) con selector persistente en el reproductor, e implementa lo que falte con contraste validado sobre fondo oscuro. Úsalo al agregar un juego o para revisar/crear skins. Memoria en `.claude/agents/memory/skin-designer.md`.
- **mobile-porter** (`.claude/agents/mobile-porter.md`) — audita e implementa mejoras responsive para que la app se vea bien en desktop y móvil (análisis estático de `globals.css` + DOM de las rutas, referencia `specs/10-controles-tactiles.md`). Úsalo al agregar un juego, cambiar el layout del reproductor o revisar el diseño móvil. Memoria en `.claude/agents/memory/mobile-porter.md`.

## Product

**Arcade Vault** (Spanish-language) es una plataforma de arcade online: los usuarios juegan y compiten por puntuaciones. Ya **no es un scaffold** — el producto está construido sobre App Router con auth, DB y varios juegos reales portados.

## Architecture

App Router project. Rutas reales en `app/`:

- `/` (`app/page.tsx`) — Home / landing.
- `/games` (`app/games/page.tsx` + `library-client.tsx`) — Biblioteca (grid, filtro por categoría).
- `/game/[id]` — Detalle del juego.
- `/play/[id]` (`app/play/[id]/page.tsx`) — Reproductor: HUD, pausa, fin, modal de guardado.
- `/hall` (`app/hall/page.tsx` + `hall-client.tsx`) — Salón de la Fama (leaderboard).
- `/about` — About + formulario de contacto (`app/api/contact/route.ts` → Resend).
- `/login` — Auth (Supabase email/password).
- `/auth/callback/route.ts` — callback de confirmación de correo de Supabase.

Convenciones:

- **Tailwind v4**: no `tailwind.config.*`. Tokens en `app/globals.css` vía `@import "tailwindcss"` + `@theme inline {}`. PostCSS plugin: `@tailwindcss/postcss`. Cada juego tiene su clase `.cover-<slug>` (portada) y `.<slug>-canvas` (canvas) en `globals.css`.
- **Path alias**: `@/*` → repo root.
- **Nav shell**: `app/nav.tsx`; sesión global vía `app/session-provider.tsx`.

## Datos, auth y Supabase

Proyecto Supabase `eqsknyiewfyggpatpfcs`, operado vía **MCP** (`execute_sql`, `apply_migration`, `generate_typescript_types`, `list_tables`). Dos tablas con RLS: `public.games` (catálogo, incluye `sort`) y `public.scores` (`game_id` FK, `user_id`, `player_name`, `score`, `created_at`). Solo usuarios autenticados insertan scores.

- `lib/games.ts` — tipos del dominio (`Game`, `ScoreRow`, `Category`, `GameColor`) + array `GAMES`. **Client-safe** (sin `next/headers`). `GAMES` se conserva como referencia del seed y para tipos; el runtime lee el catálogo desde DB.
- `lib/games-db.ts` — lecturas server-side del catálogo (`getGames`, `getGame`) desde Supabase.
- `lib/scores.ts` — `getLeaderboard(gameId, limit)` (score desc, desempate por `created_at` asc).
- `lib/supabase/{client,server,types}.ts` — clientes SSR (`@supabase/ssr`) y tipos generados (`Database`). Regenerar tipos solo si cambia el esquema.
- `app/session-provider.tsx` — `SessionProvider` / `useSession()`: `user`, `signUp/signIn/signOut`, `saveScore({ game, score })`. Conserva "jugar como invitado" (guardar requiere sesión).

## Juegos: patrón de port

Los juegos reales viven en `lib/games/<slug>.ts` (motor) + `app/play/[id]/<slug>-game.tsx` (wrapper) + un branch en `app/play/[id]/page.tsx`. El resto de slugs siguen en `SimulatedPlayer`.

- **Motor** `lib/games/<slug>.ts` — contrato `init<Nombre>(canvas, handlers) → { destroy, setPaused, restart }`. DOM y `getContext` **dentro** de `init` (nada al importar); estado por callbacks (`onScore`/`onLives`/`onLines`/`onLength`/`onLevel` + `onGameOver`); listeners nombrados con `preventDefault` acotado, removidos en `destroy`; loop con `paused`/`destroyed`/`rafId`. Sin HUD dibujado ni reinicio con Espacio (lo maneja React).
- **Wrapper** `app/play/[id]/<slug>-game.tsx` — `"use client"` + `forwardRef`; boot en `useEffect([])` que retorna `destroy`; pausa por prop; `useImperativeHandle` expone `restart`; `<canvas className="<slug>-canvas">`.
- **Branch** en `page.tsx` — `game.id === "<slug>"` → `<NombrePlayer>`, que reusa `PlayerHud`/`PauseOverlay`/`CrtBottom`/`EndModal` y adapta las etiquetas del HUD (el stat central es Vidas / Líneas / Longitud según el juego).

Juegos reales actuales: `rocas` (Asteroids), `caida` (Tetris), `bloque-buster` (Arkanoid), `serpentina` (Snake). Fuentes de port en `references/started-games/`.

## Design mockups

`references/resources/templates/` contiene los prototipos standalone (React global-script, hash routing, `localStorage`) — **referencias de diseño, no la app**. `styles.css` ahí define el lenguaje visual neon-arcade. Los mockups (`biblioteca`, `detalle`, `reproductor`, `salon`, `auth`, `nav`, `home-about`) ya fueron portados a las rutas de arriba.

## Workflow

Project follows Spec Driven Design. Specs numeradas en `specs/` (`NN-slug.md`, con `Estado:` Draft → Approved → Implementado). Features generales: `/spec` y `/spec-impl`.

**Juegos nuevos:** para portar un juego de `references/started-games/` al reproductor con su leaderboard:

1. `/add-game <carpeta>` (ej. `03-tetris`) — diseña la spec del juego (combina el patrón de specs 05 + 06), sección por sección, sin escribir código. Deja la spec en `Draft`.
2. Aprueba la spec manualmente (cambia `Estado:` a `Approved`).
3. `/add-game-impl NN` — implementa la spec aprobada paso a paso (motor `lib/games/<slug>.ts` → wrapper → branch en `page.tsx` → `INSERT` en `games` de Supabase vía MCP → entrada en `GAMES` + CSS del canvas/cover → build/lint/recorrido).

Ambas skills en `.claude/skills/`. Agregar un juego es un `INSERT` en `games`, no una migración nueva ni regeneración de tipos.
