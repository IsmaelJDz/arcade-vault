# SPEC 01 — Maqueta visual: portar las pantallas del arcade a App Router

> **Estado:** Implementado
> **Depende de:** Ninguna (primera spec)
> **Fecha:** 2026-07-19
> **Objetivo:** Portar las seis pantallas del mockup (`biblioteca`, `detalle`, `reproductor`, `salon`, `auth`) más el nav a rutas reales de App Router, solo la capa visual, sin implementar ningún juego.

Notas de contexto:

- **Estilos ya portados**: `app/globals.css` ya contiene el tema neón completo de `styles.css`. Esta spec **no toca CSS** salvo añadir clases ausentes.
- **Punto de partida real**: `layout.tsx` ya tiene fuentes + fondo + `.av-shell` (sin Nav); `page.tsx` es un hero placeholder que será reemplazado por la Biblioteca real.

---

## Alcance

**Dentro:**

- **Sesión (`app/session-provider.tsx`)**: Client Context Provider montado en `layout.tsx`. Expone `user`, `login()`, `signOut()`, `saveScore()`. Persiste en `localStorage` (`av_user`, `av_scores`), igual que el mockup.
- **Datos (`lib/games.ts`)**: port a TypeScript de `data.jsx` — `GAMES`, `CATS`, `seededScores()` con sus tipos (`Game`, `ScoreRow`).
- **Nav + footer en el layout (`app/nav.tsx`)**: Nav como client component que usa `usePathname()` para el estado activo (en vez de `route.name`), con menú móvil, contador de créditos y botón de sesión. Footer movido al layout.
- **Ruta `/` — Biblioteca (`app/page.tsx`)**: grid de juegos, búsqueda, chips de categoría, tarjetas con efecto tilt. Reemplaza el placeholder actual.
- **Ruta `/game/[id]` — Detalle (`app/game/[id]/page.tsx`)**: portada, tags, descripción, stat-strip, acciones y leaderboard lateral.
- **Ruta `/play/[id]` — Reproductor (`app/play/[id]/page.tsx`)**: HUD, arena CRT animada, controles PAUSA/FIN/SALIR, ticker de puntos falso y modal de FIN con guardado de puntuación (vía `saveScore()`).
- **Ruta `/hall` — Salón de la Fama (`app/hall/page.tsx`)**: tabs por juego, podio, tabla de puntuaciones y fila "tu marca" si hay sesión.
- **Ruta `/login` — Auth (`app/login/page.tsx`)**: tabs iniciar/crear, formulario, entrar como invitado, botones sociales (decorativos).
- **Navegación real**: enlaces `next/link` y `useRouter()` en lugar del `navigate({name})` del mockup. IDs de juego inválidos → `notFound()`.

**Fuera de alcance (para specs futuras):**

- Cualquier lógica de juego real (los juegos nunca se implementan aquí).
- Backend, API, autenticación real, OAuth (Google/GitHub son botones decorativos).
- Persistencia de puntuaciones más allá de `localStorage` (sin base de datos, sin ranking real del servidor).
- Reescritura o rediseño del CSS ya portado en `globals.css`.
- Tests (no hay runner configurado).
- SEO, metadata por ruta, i18n framework, accesibilidad más allá de lo que ya trae el mockup.
- Mostrar puntuaciones **reales** guardadas por el usuario en los leaderboards (siguen usando `seededScores` mock; `saveScore` solo persiste, no se re-lee en las tablas).

---

## Modelo de datos

Esta feature **no introduce datos nuevos**: reusa las estructuras del mockup, tipadas en TypeScript. Dos módulos las contienen.

**`lib/games.ts`** — datos y tipos compartidos (port de `data.jsx`):

```ts
type GameColor = "cyan" | "magenta" | "yellow" | "green";
type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

interface Game {
  id: string; // "bloque-buster", "caida", …
  title: string;
  short: string; // descripción corta (tarjeta)
  long: string; // descripción larga (detalle)
  cat: Category;
  cover: string; // clase CSS de portada: "cover-bricks", …
  color: GameColor; // color del botón JUGAR
  best: number; // mejor puntuación global (mock)
  plays: string; // "12.4K"
}

interface ScoreRow {
  rank: number;
  name: string; // "PX_KAI"
  score: number;
  date: string; // "dd/mm/2026"
}

const GAMES: Game[]; // los 8 juegos del mockup
const CATS: (Category | "TODOS")[]; // ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]
function seededScores(seed: number, count?: number): ScoreRow[]; // generador mock determinista
```

**Sesión (`app/session-provider.tsx`)** — estado de usuario persistido, idéntico en claves al mockup:

```ts
interface User {
  name: string; // iniciales en mayúsculas, máx 10 chars
}

interface ScoreEntry {
  game: string; // Game["id"]
  score: number;
  name: string;
  at: number; // Date.now()
}

// localStorage:
//   "av_user"   → User | null
//   "av_scores" → ScoreEntry[]

interface SessionContext {
  user: User | null;
  login: (u: User | null) => void; // null = invitado
  signOut: () => void;
  saveScore: (e: Omit<ScoreEntry, "at">) => void;
}
```

Convenciones (heredadas del mockup):

- `seededScores` es determinista por `seed` — mismas filas en cada render, sin `Math.random` real en el resultado ordenado.
- Nombre de usuario: `toUpperCase().slice(0, 10)`.
- `login(null)` = jugar como invitado (borra `av_user`).

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable.

1. **`lib/games.ts`** — portar `data.jsx` a TypeScript: tipos (`Game`, `ScoreRow`, `Category`, `GameColor`), `GAMES`, `CATS`, `seededScores()`. Sin `window.*`, usar `export`. Prueba: `npm run build` compila; import desde un archivo temporal resuelve tipos.

2. **`app/session-provider.tsx`** — Client Context Provider (`"use client"`) con `user`, `login`, `signOut`, `saveScore` y lectura/escritura de `localStorage` (`av_user`, `av_scores`). Hook `useSession()`. Lectura inicial en `useEffect` para evitar mismatch de hidratación. Prueba: montar y loguear desde consola no rompe.

3. **`app/nav.tsx` + `layout.tsx`** — Nav como client component usando `usePathname()` para estado activo; menú móvil, créditos, botón sesión (`useSession`). Montar `<SessionProvider>`, `<Nav>` y el footer (movido desde `app.jsx`) en `layout.tsx`, envolviendo `.av-shell`. Prueba: nav visible en toda ruta, links funcionan, footer al pie.

4. **`app/page.tsx` — Biblioteca** — reemplazar el hero placeholder por `Library`: hero, buscador, chips de categoría, `av-grid` con `GameCard` (tilt). Tarjetas enlazan a `/game/[id]` con `next/link`. Prueba: buscar/filtrar funciona; clic en tarjeta navega a detalle.

5. **`app/game/[id]/page.tsx` — Detalle** — portada, tags, `stat-strip`, acciones (JUGAR AHORA → `/play/[id]`, VOLVER → `/`), leaderboard lateral con `seededScores`. `id` inválido → `notFound()`. Prueba: `/game/caida` renderiza; botones navegan.

6. **`app/play/[id]/page.tsx` — Reproductor** — HUD, arena CRT animada, controles PAUSA/FIN/SALIR, ticker de puntos falso (`setInterval` en `useEffect`), modal de FIN con input de nombre y `saveScore()` de `useSession`. Prueba: puntos suben, pausa detiene, FIN abre modal, guardar muestra toast.

7. **`app/hall/page.tsx` — Salón de la Fama** — tabs por juego, podio (1/2/3), tabla con `seededScores`, fila "tu marca" si `user`. Botón volver a `/`. Prueba: cambiar tab actualiza tabla; con sesión aparece la fila amarilla.

8. **`app/login/page.tsx` — Auth** — tabs iniciar/crear, formulario, `login()` → `router.push("/")`, jugar como invitado, botones sociales decorativos. Prueba: enviar loguea y redirige; el nav pasa a mostrar el usuario.

9. **Limpieza** — verificar que ninguna clase CSS usada falte en `globals.css`; añadir solo las ausentes. `npm run build` + `npm run lint` sin errores. Prueba: recorrido completo Biblioteca → Detalle → Reproductor → guardar → Salón (fila propia) → Login.

Notas de conversión (aplican a todos los pasos de pantalla):

- Componentes con estado/eventos llevan `"use client"`.
- `navigate({name, id})` → `next/link` o `useRouter().push()`.
- `React.useRef`/`useState`/`useEffect` → imports directos de React.
- `window.X = X` desaparece; se usa `export`.

---

## Criterios de aceptación

**Build y navegación**

- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] `npm run lint` pasa sin errores.
- [ ] El Nav y el footer aparecen en las cinco rutas (`/`, `/game/[id]`, `/play/[id]`, `/hall`, `/login`).
- [ ] El enlace activo del Nav se resalta según la ruta actual (Biblioteca activa también en `/game/*` y `/play/*`).
- [ ] El botón atrás/adelante del navegador cambia de pantalla correctamente.

**Biblioteca (`/`)**

- [ ] Se muestran las 8 tarjetas de `GAMES` en el grid.
- [ ] Escribir en el buscador filtra las tarjetas por título en tiempo real.
- [ ] Clic en un chip de categoría filtra el grid; "TODOS" muestra todo.
- [ ] Sin resultados muestra el bloque "NO HAY RESULTADOS".
- [ ] Clic en una tarjeta navega a `/game/[id]` de ese juego.

**Detalle (`/game/[id]`)**

- [ ] `/game/caida` renderiza portada, descripción larga, tags y stat-strip del juego.
- [ ] El leaderboard lateral muestra filas de `seededScores`.
- [ ] "JUGAR AHORA" navega a `/play/[id]`; "VOLVER AL VAULT" navega a `/`.
- [ ] Un `id` inexistente (p. ej. `/game/xxx`) muestra la página `notFound()`.

**Reproductor (`/play/[id]`)**

- [ ] La puntuación del HUD sube sola mientras no está en pausa ni terminado.
- [ ] "PAUSA" detiene el ticker y muestra el overlay "EN PAUSA"; "REANUDAR" lo reanuda.
- [ ] "FIN" abre el modal de FIN con la puntuación final.
- [ ] Guardar en el modal persiste en `av_scores` y muestra el toast "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" reinicia el estado; "SALIR" vuelve al detalle.

**Salón de la Fama (`/hall`)**

- [ ] Cambiar de tab actualiza podio y tabla al juego seleccionado.
- [ ] El podio muestra los puestos 01/02/03 con oro/plata/bronce.
- [ ] Con sesión iniciada aparece la fila amarilla "TU MEJOR MARCA".
- [ ] Sin sesión, esa fila no aparece.

**Auth (`/login`) y sesión**

- [ ] Enviar el formulario inicia sesión y redirige a `/`.
- [ ] Tras login, el Nav muestra el nombre del usuario en vez de "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin usuario logueado.
- [ ] El usuario logueado sobrevive a una recarga de página (persistido en `av_user`).
- [ ] Clic en el nombre del usuario en el Nav cierra la sesión.

---

## Decisiones

- **Sí:** Rutas reales de App Router (`/`, `/game/[id]`, `/play/[id]`, `/hall`, `/login`). URLs compartibles, back/forward nativo, layout con Nav compartido. Patrón idiomático de Next.js.
- **No:** SPA con estado `route` y hash routing como el mockup. Fiel al prototipo pero desperdicia App Router y no da URLs reales.
- **Sí:** URLs en inglés (`/game`, `/play`, `/hall`, `/login`). Coinciden con los `route.name` internos del mockup y evitan acentos/eñes en paths.
- **No:** URLs en español. La UI sigue en español, pero las rutas en inglés son más neutrales.
- **Sí:** Sesión con React Context + `localStorage` (`av_user`, `av_scores`), mismas claves que el mockup. El Nav reacciona al login, el Salón muestra "tu marca" y la sesión sobrevive recargas.
- **No:** Estado solo en memoria. El login no aguantaría recargas.
- **No:** Auth real / backend / OAuth. Fuera de una maqueta visual; va en otra spec.
- **Sí:** Mantener la simulación visual del reproductor (ticker falso, arena animada, modal de FIN). Es chrome visual, no un juego.
- **No:** Reproductor congelado estático. Perdería la animación que define la pantalla.
- **Sí:** Leaderboards siguen usando `seededScores` mock. Tablas llenas y deterministas sin backend.
- **No:** Re-leer `av_scores` para poblar las tablas con puntuaciones reales. Complejidad de merge/orden sin valor en una maqueta; `saveScore` solo persiste.
- **Sí:** Reusar `app/globals.css` tal cual. Solo se añaden clases ausentes si falta alguna.
- **No:** Rediseñar o refactorizar el CSS. Fuera de alcance.
- **Sí:** `id` de juego inválido → `notFound()`. Comportamiento estándar de App Router.
- **No:** Redirigir a `/` silenciosamente. Oculta errores de enlace.

---

## Riesgos

| Riesgo                                                                                                                                            | Mitigación                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mismatch de hidratación al leer `localStorage` en el primer render (servidor no tiene `av_user`).                                                 | El Provider inicia `user = null` y lee `localStorage` en `useEffect` tras montar; el Nav renderiza el estado deslogueado en SSR y se actualiza en cliente. Nunca leer `localStorage` durante el render. |
| `localStorage` deshabilitado (modo privado / SSR).                                                                                                | Envolver accesos en `try/catch` (como el mockup); si falla, la sesión queda solo en memoria y la app sigue funcionando sin persistir.                                                                   |
| `seededScores` es determinista, pero el reproductor usa `Math.random`/`Date.now` en el ticker; si se ejecutaran en render causarían mismatch SSR. | El ticker vive dentro de `useEffect`/`setInterval` (solo cliente), nunca en el cuerpo del render.                                                                                                       |
| Falta alguna clase CSS que el mockup daba por hecha y en `globals.css` no se portó.                                                               | El paso 9 verifica clases usadas vs. `globals.css` y añade solo las ausentes; no se rediseña.                                                                                                           |
| El efecto tilt de las tarjetas manipula `style.transform` vía `ref`; un `Link` envolvente podría tragarse eventos.                                | Mantener el tilt en el `div` de la tarjeta con `onMouseMove/onMouseLeave` y navegar con `useRouter().push()` en `onClick`, o `Link` interno sin romper el `ref`.                                        |

---

## Lo que **no** entra en esta spec

- Lógica de juego real (ningún juego se implementa).
- Backend, API, autenticación real, OAuth.
- Persistencia de puntuaciones fuera de `localStorage` ni ranking real del servidor.
- Rediseño del CSS ya portado en `globals.css`.
- Tests, SEO/metadata por ruta, framework de i18n.

Cada uno de estos, si llega, va en su propia spec.
