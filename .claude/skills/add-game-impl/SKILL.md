---
name: add-game-impl
description: Implementa una spec de juego aprobada (creada con /add-game). Valida que el estado signifique "Approved" (en cualquier idioma), crea la rama del spec, y porta el juego paso a paso — motor, wrapper, branch del reproductor, fila en games (Supabase vía MCP), GAMES/CSS — pausando tras cada paso para revisar el diff.
disable-model-invocation: true
argument-hint: <NN-slug>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git add:*), Bash(cat:*), Bash(ls:*), Bash(npm run build:*), Bash(npm run lint:*)
---

# /add-game-impl — Implementador de specs de juego aprobadas

Implementa una spec creada por `/add-game`. Además de las herramientas Git listadas arriba, esta
skill usa las **MCP de Supabase** (`execute_sql`, `apply_migration`, `list_tables`) para sembrar la
fila del juego en `public.games`. Las tablas `games`/`scores` ya existen (proyecto
`eqsknyiewfyggpatpfcs`); agregar un juego es un `INSERT`, no una migración nueva.

## Contexto de sesión

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

---

## Instrucciones

Sigue estas cuatro fases en orden estricto. **No avances si la anterior no se completó.** Responde
en español.

### Fase 1 — Identificar la spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío: lista `specs/` (arriba), pide el nombre exacto y **detente**.

Si tiene valor: busca el archivo en `specs/` (acepta nombre completo `07-tetris-game`, solo el
número `07`, o solo el slug `tetris-game`). Si no lo encuentras, muestra las specs disponibles y pide
corregir. Si lo encuentras, continúa.

### Fase 2 — Validar el estado

Lee la spec encontrada:
!`cat specs/$ARGUMENTS.md 2>/dev/null || echo "FILE_NOT_FOUND"`

Busca la línea de estado (`**Estado:**` / `**Status:**`, en cualquier idioma). **Regla absoluta:**
solo continúas si el estado **significa "Approved"** (`Approved`, `Aprobado`, `Aprovado`, `Approuvé`,
…). Cualquier otro (`Draft`/`Borrador`, `Implementado`, `Obsoleto`, o no reconocido) → **detente** y
muestra:

```
❌ No puedo implementar esta spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Approved" (p. ej. `Approved`, `Aprobado`).

Para continuar:
  1. Si está lista, abre la spec y cambia el estado a "Approved" manualmente (lo hace el humano).
  2. Si aún necesita trabajo, retómala con /add-game <juego>.
```

No ofrezcas alternativas ni "puedo empezar de todos modos". El bloqueo es intencional.

Verifica también que la spec corresponde a un **juego con fuente en `references/started-games/`**
(esta skill solo porta juegos presentes ahí). Si la carpeta fuente que la spec referencia no existe,
detente y pide agregarla.

### Fase 3 — Crear la rama y resumir

Confirmado el estado Approved:

1. Deriva la rama del nombre del archivo sin extensión: `spec-NN-slug` (p. ej.
   `07-tetris-game.md` → `spec-07-tetris-game`).
2. Si no existe, créala con `git checkout -b spec-NN-slug`; si existe, avisa que se retoma trabajo;
   en ambos casos haz checkout y confirma.
3. Muestra al usuario:
   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)
   Estado: Approved   (← el valor real hallado)
   ```
4. **Aún no implementes.** Muestra primero el resumen de la spec: Objetivo, Alcance, Plan de
   implementación (pasos numerados) y Criterios de aceptación.

### Fase 4 — Implementar paso a paso

Di al usuario:

```
Voy a implementar la spec siguiendo el plan exactamente, pausando tras cada paso para que revises el diff.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita. Luego, por cada paso del plan de la spec: implementa, muestra qué
archivos tocaste, di `Paso N completado. Revisa el diff y dime si sigo con el Paso N+1.` y espera.

**Regla sobre todo:** implementa lo que dice la spec. Si algo te parece subóptimo, coméntalo como
observación pero implementa lo acordado. Los cambios a la spec van a la spec, no al código por sorpresa.

**Antes de tocar routing/params/server components**, lee la guía correspondiente en
`node_modules/next/dist/docs/` (es Next.js 16, con diferencias respecto a versiones previas).

**Patrón del port** (referencias reales del repo — imítalas, no reinventes):

- **Motor** `lib/games/<slug>.ts` — modela `lib/games/asteroids.ts`: contrato
  `init<Nombre>(canvas, handlers) → { destroy, setPaused, restart }`; DOM y `getContext` **dentro**
  de `init` (nada al importar); globals → `let` locales; clases anidadas que cierran sobre
  `ctx`/`keys`/dimensiones; listeners nombrados con `preventDefault` de las teclas del juego,
  removidos en `destroy`; sin HUD/overlay dibujado ni reinicio con Espacio; estado por callbacks con
  detección de cambio; loop con `paused`/`destroyed`/`rafId` y reset de `lastTime` al reanudar.
- **Wrapper** `app/play/[id]/<slug>-game.tsx` — modela `asteroids-game.tsx`: `"use client"` +
  `forwardRef`; `canvasRef`+`controlsRef`; `handlersRef` refrescado cada render; boot en
  `useEffect([])` que retorna `destroy`; pausa por prop `useEffect([paused])`; `useImperativeHandle`
  expone `restart`; render `<canvas width height className="<slug>-canvas">`.
- **Branch del reproductor** `app/play/[id]/page.tsx` — añade `game.id === "<slug>"` →
  `<<Nombre>Player>` (modela `AsteroidsPlayer`): estado real de HUD por callbacks; reusa
  `PlayerHud`/`PauseOverlay`/`CrtBottom`/`EndModal`; adapta las etiquetas del HUD a los campos del
  juego; PAUSA→`setPaused`, FIN→game over, `onGameOver`→modal, GUARDAR→`saveScore({ game:"<slug>",
score })`, JUGAR DE NUEVO→`restart`, SALIR→`/game/<slug>`.
- **Seed en Supabase** — usa MCP `execute_sql` con el `INSERT into public.games (...)` de la spec;
  verifica con `execute_sql "select * from games where id='<slug>'"`. **No** regeneres tipos (agregar
  filas no cambia el esquema). Solo si la spec pidiera columnas nuevas usarías `apply_migration` +
  `generate_typescript_types` → `lib/supabase/types.ts`.
- **Catálogo runtime** — agrega la entrada gemela en `GAMES` de `lib/games.ts` y la clase
  `.cover-<slug>` en `app/globals.css`. `getGames/getGame/getLeaderboard`, Library, Detalle y Hall lo
  recogen solos.
- **CSS del canvas** — regla `.<slug>-canvas` (absolute-fill + `object-fit:contain`) reusando
  `.game-controls`/`.keyboard-notice` con la media query `(hover:none) and (pointer:coarse)`.

**Si encuentras una ambigüedad** que la spec no resuelve: detente, descríbela, presenta 2–3 opciones
concretas y espera la decisión. No improvises.

**Si piden algo fuera del alcance de la spec:** recuérdalo, sugiere anotarlo para otra spec y no lo
implementes en esta rama.

**Al terminar el último paso:**

```
✅ Todos los pasos del plan están implementados.

Siguiente: verifica los criterios de aceptación uno por uno (build, lint y el recorrido
Biblioteca → Detalle → jugar → FIN → GUARDAR → Hall muestra la marca).
Si todos pasan, cambia el estado de la spec a "Implementado" y haz el commit final antes de mergear.
```

---

## Resumen del comportamiento esperado

```
/add-game-impl 07-tetris-game

  Fase 1 → Encuentra specs/07-tetris-game.md
  Fase 2 → Estado "Approved" → ✅ continúa   (Draft/Implementado → ❌ se detiene)
  Fase 3 → git checkout -b spec-07-tetris-game; muestra objetivo/alcance/plan/criterios
  Fase 4 → Implementa paso a paso con pausas:
           motor → wrapper → branch page.tsx → seed games (MCP) → GAMES+cover CSS → canvas CSS →
           build/lint/recorrido
           Termina recordando verificar criterios y marcar la spec "Implementado".
```
