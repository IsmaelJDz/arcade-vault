# SPEC 02 — Home landing + reubicación de Biblioteca a `/games`

> **Estado:** Implementado
> **Depende de:** `01-visual-screens-app-router.md`
> **Fecha:** 2026-07-25
> **Objetivo:** Portar el Home del mockup `home-about` como nueva ruta `/`, reubicar la Biblioteca actual en `/games` y actualizar el Nav en consecuencia (la pantalla About queda fuera de esta spec).

---

## Alcance

**Dentro:**

- **Ruta `/` — Home (`app/page.tsx`, nuevo)**: hero con `FloatingSilhouettes` decorativas, sección "¿Por qué Arcade Vault?" (4 `feature-card`), sección "Juegos disponibles ahora" (`mini-rail` con `GAMES.slice(0,6)` de `lib/games.ts`, reutiliza los `cover-*` ya portados), sección de stats (3 bloques estáticos), sección "Actividad en vivo" (últimas puntuaciones + top jugadores — arrays hardcodeados, igual que el mockup), sección de precios (plan único gratis + FAQ), CTA final. Reveal-on-scroll vía `IntersectionObserver` en un client component.
- **Ruta `/games` (`app/games/page.tsx`)**: contenido actual de Biblioteca movido tal cual desde `app/page.tsx`, sin cambios funcionales ni visuales.
- **`app/nav.tsx`**: nuevo link "Inicio" → `/` (activo solo en `/` exacto); el link "Biblioteca" cambia su `href` de `/` a `/games` (activo en `/games`, `/game/*`, `/play/*`). Aplica al nav desktop y al panel móvil.
- **Redirecciones actualizadas** — los 5 `router.push("/")` que hoy significan "volver a la biblioteca" pasan a `router.push("/games")`:
  - `app/game/[id]/page.tsx` (VOLVER AL VAULT)
  - `app/login/page.tsx` (redirect tras login)
  - `app/login/page.tsx` (redirect tras JUGAR COMO INVITADO)
  - `app/hall/page.tsx` (volver)
  - `app/play/[id]/page.tsx` (SALIR)
- **CSS**: portar a `app/globals.css` el bloque `HOME PAGE` de `references/resources/templates/home-about/styles.css` (≈líneas 930–1069), solo las clases que usa Home.

**Fuera de alcance (para specs futuras):**

- Pantalla About/Contacto (`about.jsx`, formulario, highlights) — spec propia.
- Cambiar las URLs de detalle/reproductor/salón/login (`/game/[id]`, `/play/[id]`, `/hall`, `/login`) — no se tocan.
- Datos reales para "Actividad en vivo" o stats del Home — quedan hardcodeados como en el mockup; no se conectan a `seededScores` ni a datos reales de partidas.
- Backend/API de contacto (no aplica: About queda fuera).
- Rediseño del CSS ya portado (solo se añaden las clases nuevas del Home).

---

## Modelo de datos

Esta feature **no introduce datos nuevos**. Se omite esta sección.

- Home reutiliza `Game`, `GAMES`, `CATS` de `lib/games.ts` tal cual (sin cambios), solo para el `mini-rail` (`GAMES.slice(0, 6)`).
- Los arrays de "Actividad en vivo" (últimas puntuaciones, top jugadores), los 3 bloques de stats y los bullets de precios son **literales locales dentro del componente `Home`**, igual que en el mockup — no se exportan, no se tipan como modelo compartido, no salen de `app/page.tsx`.

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable.

1. **Mover Biblioteca a `/games`** — mover `app/page.tsx` → `app/games/page.tsx` tal cual (sin cambios de lógica). Dejar un `app/page.tsx` placeholder mínimo para no romper `/` mientras se construye el Home. Prueba: `npm run build` compila; `/games` funciona igual que la Biblioteca actual; `/` sigue compilando.

2. **`app/nav.tsx`** — nuevo link "Inicio" → `/` (activo solo en `/` exacto); "Biblioteca" cambia su `href` a `/games` (activo en `/games`, `/game/*`, `/play/*`). Aplica a nav desktop y panel móvil. Prueba: el nav resalta el link correcto en cada ruta.

3. **Redirects a `/games`** — actualizar los 5 `router.push("/")` identificados: `game/[id]` (VOLVER AL VAULT), `login` (tras login y tras invitado), `hall` (volver), `play/[id]` (SALIR). Prueba: recorrido manual confirma cada redirect.

4. **CSS del Home** — portar a `app/globals.css` el bloque `HOME PAGE` de `references/resources/templates/home-about/styles.css` (~líneas 930–1069). Sin rediseñar clases ya existentes.

5. **`app/page.tsx` — Hero** — reemplaza el placeholder del paso 1: hero, `FloatingSilhouettes`, CTAs "EXPLORAR JUEGOS" (→ `/games`) y "CREAR CUENTA" (→ `/login`). Prueba: hero visible, ambos botones navegan.

6. **`app/page.tsx` — Features, Mini-rail, Stats** — sección "¿Por qué Arcade Vault?" (4 `feature-card`), "Juegos disponibles ahora" (`GAMES.slice(0,6)` vía `MiniCard`, botón "ver todos" → `/games`), sección de stats (3 bloques estáticos). Prueba: las 3 secciones renderizan; clic en mini-card navega a `/game/[id]`.

7. **`app/page.tsx` — Actividad en vivo, Precios, CTA final** — ticker de puntuaciones + top jugadores (arrays hardcodeados), plan único + FAQ, CTA final. Prueba: "VER SALÓN" → `/hall`; "EMPEZAR GRATIS" y el CTA final → `/login` y `/games` respectivamente.

8. **Reveal-on-scroll** — hook `useReveal` (`IntersectionObserver`) local al componente `Home`, aplicado a las secciones con clase `.reveal`. Prueba: las secciones aparecen con fade/translate al hacer scroll.

9. **Limpieza** — verificar que ninguna clase CSS usada por Home falte en `globals.css`; `npm run build` + `npm run lint` sin errores. Prueba: recorrido completo Home → Games → Detalle → Reproductor → Salón → Login y de regreso, confirmando los 5 redirects a `/games`.

Notas de conversión (igual que spec 01): componentes con estado/eventos llevan `"use client"`; `navigate({name})` → `next/link`/`useRouter().push()`; sin `window.X = X`, se usa `export`.

---

## Criterios de aceptación

**Ruteo y Nav**

- [x] `npm run build` compila sin errores de TypeScript.
- [x] `npm run lint` pasa sin errores.
- [x] `/games` renderiza la Biblioteca (grid, buscador, chips, tarjetas) igual que antes de la reubicación.
- [x] `/` renderiza el nuevo Home.
- [x] El link "Inicio" del Nav está activo solo en `/`.
- [x] El link "Biblioteca" del Nav está activo en `/games`, `/game/*` y `/play/*`.
- [x] Ambos comportamientos se replican en el panel móvil.

**Redirects**

- [x] "VOLVER AL VAULT" en `/game/[id]` navega a `/games`.
- [x] "SALIR" en `/play/[id]` navega a `/games`.
- [x] El botón "volver" en `/hall` navega a `/games`.
- [x] Enviar el formulario de login navega a `/games`.
- [x] "JUGAR COMO INVITADO" navega a `/games`.

**Home (`/`)**

- [x] El hero muestra título, subtítulo, silhouettes decorativas y ambos CTAs.
- [x] "EXPLORAR JUEGOS" navega a `/games`; "CREAR CUENTA" navega a `/login`.
- [x] La sección de features muestra las 4 tarjetas.
- [x] El mini-rail muestra 6 juegos de `GAMES`; clic en una mini-card navega a `/game/[id]` de ese juego.
- [x] "VER TODOS LOS JUEGOS" navega a `/games`.
- [x] La sección de stats muestra los 3 bloques estáticos.
- [x] La sección "Actividad en vivo" muestra el ticker de puntuaciones y el top de jugadores (datos hardcodeados).
- [x] "VER SALÓN" navega a `/hall`.
- [x] La sección de precios muestra el plan único y el FAQ; "EMPEZAR GRATIS" navega a `/login`.
- [x] El CTA final navega a `/games`.
- [x] Las secciones con clase `.reveal` aparecen (fade/translate) al hacer scroll hasta ellas.

---

## Decisiones

- **Sí:** Home pasa a ser la nueva `/`; Biblioteca se reubica en `/games`. Alinea la portada con la intención del mockup (Home como landing) sin perder la Biblioteca ya implementada.
- **No:** Home en una ruta secundaria (ej. `/inicio`) dejando Biblioteca en `/`. Dejaría la portada real del sitio sin landing de marketing, que es justo lo que esta spec busca resolver.
- **Sí:** Nombrar la ruta `/games` (inglés) en vez de `/biblioteca`. Consistente con las rutas ya existentes (`/game`, `/play`, `/hall`, `/login`); la UI visible sigue en español ("Biblioteca").
- **Sí:** Los 5 `router.push("/")` que hoy vuelven a la Biblioteca pasan a `router.push("/games")`. Tras loguearse o salir de un juego el usuario espera la zona funcional, no el landing de marketing.
- **No:** Dejarlos apuntando a `/` (Home). Metería al usuario en contenido de marketing cada vez que sale de un juego o inicia sesión — mala experiencia.
- **No incluir la pantalla About/Contacto en esta spec.** Queda pospuesta para una spec futura; el Nav no agrega "Acerca de" todavía (evita un link a una ruta inexistente).
- **Sí:** Los datos de "Actividad en vivo", stats y precios del Home quedan como literales hardcodeados, igual que el mockup. No se conectan a `seededScores` ni a `lib/games.ts` más allá del `mini-rail`. Es contenido de marketing, no un leaderboard real; conectarlo abriría alcance sin valor claro para esta spec.
- **No:** Derivar esos datos de las estructuras reales. Complejidad de agregación/orden sin necesidad para una landing decorativa.
- **Sí:** Reusar `app/globals.css` tal cual, solo añadiendo el bloque `HOME PAGE` del mockup. Mismo patrón que spec 01.
- **No:** Rediseñar o refactorizar CSS existente. Fuera de alcance.

---

## Riesgos

| Riesgo                                                                                                                                              | Mitigación                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mover `app/page.tsx` → `app/games/page.tsx` puede romper imports si alguno usa rutas relativas en vez del alias `@/*`.                              | Verificar tras mover que todos los imports usan `@/lib/games` y similares; `npm run build` detecta cualquier ruptura.                                                            |
| Quedar algún `router.push("/")` sin actualizar (o que aparezca uno nuevo no identificado) y el usuario caiga en Home en vez de en la Biblioteca.    | Antes de cerrar el paso 3, correr `grep -rn 'push("/")'` en `app/` y confirmar que ninguno quede apuntando a `/` salvo los que realmente deben ir a Home (CTAs del propio Home). |
| El hook `useReveal` (`IntersectionObserver`) corre en el cuerpo del render en vez de en `useEffect`, causando mismatch de hidratación SSR.          | Igual que en spec 01: el observer solo se monta dentro de `useEffect`, nunca durante el render.                                                                                  |
| Falte alguna clase CSS del bloque `HOME PAGE` del mockup que Home da por hecha (silhouettes, mini-rail, stats, etc.) y no se portó a `globals.css`. | El paso 9 (limpieza) compara clases usadas en el JSX de Home contra `globals.css` y añade solo las ausentes.                                                                     |

---

## Lo que **no** entra en esta spec

- Pantalla About/Contacto (`about.jsx`), formulario de contacto, highlights.
- Nuevas rutas o cambios de URL para detalle/reproductor/salón/login.
- Datos reales para "Actividad en vivo" o stats del Home (siguen hardcodeados).
- Backend/API de contacto.
- Rediseño del CSS ya portado.

Cada uno de estos, si llega, va en su propia spec.
