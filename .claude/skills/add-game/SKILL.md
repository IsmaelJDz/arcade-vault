---
name: add-game
description: Diseña la spec para portar un juego de references/started-games/ al reproductor de Arcade Vault junto con su leaderboard (motor + catálogo Supabase). Hace preguntas antes de proponer estructura y construye la spec sección por sección. Úsala antes de escribir código de un juego nuevo.
disable-model-invocation: true
argument-hint: "<carpeta-de-references o slug> (ej. 03-tetris)"
---

# /add-game — Diseñador de spec para portar un juego

Esta skill produce una **spec** que combina el patrón de la spec 05 (portar un juego canvas al
reproductor `/play/[id]`) con el de la spec 06 (fila en `games` de Supabase + Hall/leaderboard).
**Aquí no escribes código.** Tu trabajo es entender el juego fuente, aclarar lo ambiguo con
preguntas y desarrollar la spec sección por sección hasta guardarla en `specs/`. La implementación
la hace después `/add-game-impl`.

## Filosofía

Una spec no es documentación decorativa: es el contrato que guía la implementación. Si la spec es
vaga, el código improvisa. Por eso este flujo es **deliberadamente lento al definir** y **rápido al
escribir**. Toda tu salida va en **español** (convención del repo).

Lee `template.md` (en el mismo directorio que esta skill) para ver la estructura completa que
seguirá la spec. Apóyate en ella en cada paso. Las specs 05 y 06 en `specs/` son el modelo a imitar.

## Flujo del comando

Sigue las cuatro fases en orden. **No saltes fases.** Si el usuario quiere ir más rápido,
recuérdale que el costo de una spec mala se paga después en código.

### Fase 1 — Validar la fuente y el contexto

Esta skill **solo porta juegos presentes en `references/started-games/`**.

1. Toma el argumento `$ARGUMENTS`. Si viene vacío, ejecuta `ls references/started-games/` y pide al
   usuario que indique cuál juego portar. Detente hasta que responda.
2. Resuelve el argumento a una carpeta dentro de `references/started-games/` (acepta el nombre
   completo `03-tetris`, solo el número `03`, o solo el slug `tetris`).
3. **Si no existe** una carpeta que corresponda: **detente**. Muestra el listado de
   `references/started-games/` y di al usuario que primero agregue el juego a esa carpeta. No
   inventes un scaffold sin fuente ni continúes.
4. Lee `CLAUDE.md` del repo raíz y lista `specs/` para conocer las convenciones y el próximo número
   secuencial `NN`.
5. Lee al menos las specs 05 y 06 (`specs/05-asteroids-game.md`, `specs/06-games-scores-leaderboard.md`)
   para reproducir su estructura, criterios de aceptación y decisiones.

### Fase 2 — Inspeccionar el juego fuente

Antes de preguntar, entiende qué estás portando. En la carpeta del juego lee:

- `game.js` — el motor. Detecta: accesos al DOM en el nivel de módulo (`document.getElementById`,
  `canvas.getContext`), estado global (`let ship, …`), clases con `update(dt)`/`draw()`, el loop
  `requestAnimationFrame`, las **teclas** usadas y el reinicio con Espacio en game over.
- `index.html` — tamaño del canvas (p. ej. 800×600) y scripts que carga.
- `CLAUDE.md` / `README.md` del juego — arquitectura y estado del juego.
- **Archivos extra si existen**: `levels.js`, `assets/` (spritesheets, sonidos), `skills-lock.json`.
  Estos amplían el alcance del port; señálalos explícitamente.

Identifica los **campos reales de HUD** del juego (no asumas score/vidas/nivel): pueden ser
`score/vidas/nivel`, `score/líneas/nivel`, etc. Estos definen los `handlers` del motor
(`onScore/onLives/onLevel/…` + `onGameOver`).

### Fase 3 — Aclarar con preguntas

Detecta ambigüedades y **pregunta**, no asumas. Pregunta en bloques de 3 a 5, numeradas, y espera
respuesta antes de seguir. Categorías a cubrir siempre:

- **Identidad del catálogo:** `id` (slug, PK de texto, se usa en rutas `/game/<slug>`,
  `/play/<slug>` y en `saveScore({ game: "<slug>" })`), `title`, `short`, `long`, `cat`
  (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `color` (`cyan|magenta|yellow|green`), `cover` (clase CSS
  `cover-<slug>`), y los valores estáticos `best`/`plays` a sembrar, y `sort`.
- **HUD y controles:** qué campos muestra el HUD y qué teclas usa (para el `preventDefault` acotado).
- **Assets extra:** si hay `levels.js`/sprites/sonidos, ¿se portan, se inlinean como data, o se
  difieren? (El **sonido quedó fuera** en la spec 05 — usa ese precedente como recomendación por
  defecto: diferir sonido salvo que el usuario lo pida.)
- **Alcance / fuera de alcance:** controles táctiles, mejor score persistente, dificultad
  configurable, etc. — normalmente fuera (como en 05/06).
- **Decisiones cerradas:** algo que el usuario ya decidió y no quiere reabrir.

Cuando ofrezcas opciones, da 2–4, marca tu recomendación y por qué. Si una respuesta abre otra caja
de Pandora (p. ej. "y también multijugador"), señala que merece su propia spec y pregunta si queda
fuera de esta.

**Deja de preguntar** cuando puedas responder sin asumir: (1) ¿qué archivos aparecen o cambian?,
(2) ¿cuál es el primer paso ejecutable y cuál el último?, (3) ¿cómo verifico que está terminado?

### Fase 4 — Redactar y guardar la spec

Desarrolla la spec **sección por sección** usando `template.md`, mostrando cada sección y esperando
confirmación antes de la siguiente. Orden estricto (ver `template.md`):

1. **Header** — Estado (`Draft`), Depende de (`01`, `05`, `06`), Fecha, Objetivo en **una** frase.
2. **Alcance** — Dentro / Fuera explícitos.
3. **Modelo de datos** — el contrato `init<Nombre>(canvas, handlers) → { destroy, setPaused, restart }`
   con los `handlers` reales del juego, **y** la fila a sembrar en `public.games`. Deja claro que
   `scores` **no cambia de esquema** (solo se inserta al jugar) — agregar el juego es un `INSERT` en
   `games`, sin migración nueva ni regeneración de tipos.
4. **Plan de implementación** — los pasos numerados que ejecutará `/add-game-impl` (motor → wrapper
   → branch en `page.tsx` → seed en `games` vía MCP → `GAMES` + `cover` CSS → CSS del canvas →
   build/lint/recorrido). Cada paso deja el sistema compilando.
5. **Criterios de aceptación** — checklist booleano, tomado y adaptado de 05 (jugabilidad, HUD,
   pausa, fin, limpieza) y 06 (fila en `games`, Detalle/Library/Hall lo recogen, guardado gateado).
6. **Decisiones** — elegido vs descartado, con justificación breve.
7. **Riesgos** — solo si aplican (limpieza de rAF/listeners, DOM al importar, `preventDefault`
   acotado, sincronía HUD, escalado del canvas, `restart` completo).

Al terminar:

1. Determina el próximo número mirando `specs/`.
2. Genera un slug del objetivo (p. ej. `tetris-game`).
3. Confirma el nombre `specs/NN-<slug>.md` con el usuario antes de escribir.
4. Crea el archivo con todas las secciones aprobadas, **Estado: Draft**. **No** lo marques
   `Approved` automáticamente — eso lo hace el humano tras releerla.
5. Confirma al usuario: ruta creada, recordatorio de que está en `Draft`, y el siguiente paso:
   _"Cuando la apruebes, implementa con `/add-game-impl NN`."_

## Reglas duras

- **Nunca escribas código** durante esta skill. Solo el `.md` de la spec al final.
- **Solo desde `references/started-games/`.** Si el juego no está ahí, detente y pide agregarlo.
- **Nunca asumas** ids, nombres o estructuras que el usuario no confirmó. Si falta info, pregunta.
- **Nunca generes la spec completa de una sola vez.** Sección por sección, con confirmación.
- Si el juego es demasiado grande (muchos assets, múltiples modos), propón acotar o dividir antes.

## Argumentos

Si invocan `/add-game 03-tetris`, usa `03-tetris` como carpeta fuente y base del slug (confirma el
nombre del archivo antes de escribir). Si invocan `/add-game` sin argumento, empieza listando
`references/started-games/` y pregunta cuál portar.
