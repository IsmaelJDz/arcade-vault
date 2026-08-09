# Memoria — mobile-porter

Estados: ok / corregido / pendiente / requiere-spec

| Fecha      | Ruta            | Hallazgo                                                                                                                                   | Estado        | Notas                                                                                                                              |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-09 | Shell (nav)     | A ≤390px el logo + «Iniciar Sesión» + hamburguesa sumaban ~378px: la hamburguesa quedaba recortada (`body{overflow-x:hidden}` la ocultaba) | corregido     | Bloque `@media (max-width: 520px)` que comprime gap/padding/fuentes del nav                                                        |
| 2026-08-09 | Shell (nav)     | Breakpoint del colapso a hamburguesa en 840px, fuera de la escala canónica                                                                 | corregido     | 840 → 900 (convergencia gradual, regla tocada)                                                                                     |
| 2026-08-09 | `/play/*`       | Reproductor con scroll vertical en portrait: el gamepad MK-II quedaba bajo el pliegue (docH ~870 a 360×800)                                | corregido     | HUD compacto ≤720, `.crt` padding 12, `.crt-bottom` en una línea ≤520; medido 802px de documento a 360×800, gamepad termina en 706 |
| 2026-08-09 | `/play/*`       | `.crt` calculaba el chrome en 372/382px; en móvil el chrome real es ~490px (HUD de tres filas)                                             | corregido     | Nueva regla `(hover:none) and (pointer:coarse) and (max-width:720px)` → `max(240px, calc((100dvh - 490px) * 4 / 3))`               |
| 2026-08-09 | `/play/*`       | HUD con selector de skin (5 juegos, incluida Caída): el `style` inline `gap:24` impedía compactarlo por CSS                                | corregido     | Clase `.hud-stats` en `globals.css` + cambio mínimo en `page.tsx`; a 360px el HUD mide 160px (antes ~263px)                        |
| 2026-08-09 | `/play/*`       | `.touch-shell-body` con `space-between` dejaba el D-pad pegado a la izquierda en layouts sin botones (serpentina, frogger, bloque-buster)  | corregido     | `.touch-actions:empty{display:none}` + `:has()` para centrar el D-pad                                                              |
| 2026-08-09 | `/play/frogger` | Canvas 8:7 en pantalla 4:3: pillarbox; a 360px la celda de 40px se ve a ~17px (jugable) pero el HUD interno (12px) queda a ~5px            | requiere-spec | El motor `lib/games/*` es intocable; el HUD de React ya duplica Puntuación/Vidas/Nivel                                             |
| 2026-08-09 | `/hall`         | Tabla de 4 columnas: la cabecera «PUNTUACIÓN» (pixel 12px = 130px) desbordaba su celda de 90px y la fila se recortaba a 360px              | corregido     | ≤520px: 3 columnas (`44px minmax(0,1fr) auto`), se oculta la fecha, cabecera a 8px                                                 |
| 2026-08-09 | `/`             | `.activity-grid` con `1fr`: la pista crecía al min-content del ticker y el documento medía 372px a 360px de viewport                       | corregido     | `minmax(0, 1fr)` en el bloque ≤900                                                                                                 |
| 2026-08-09 | `/`             | `.home-hero` con `min-height: calc(100vh - 60px)`                                                                                          | corregido     | `100vh` → `100dvh`                                                                                                                 |
| 2026-08-09 | `/game/[id]`    | `.stat-strip` con valores pixel de 16px: marcas de 6-7 dígitos y las estrellas desbordaban la columna de 1/3                               | corregido     | `clamp(11px, 3.4vw, 16px)` + padding fluido + `min-width: 0`                                                                       |
| 2026-08-09 | Global          | Targets táctiles por debajo de 44px: `.btn` (~40px), `.chip` (~39px), `.skin-btn` (~32px), hamburguesa, logo, input de búsqueda            | corregido     | `min-height: 44px` bajo `(hover:none) and (pointer:coarse)`; verificado: 0 targets <44px en las 8 rutas                            |
| 2026-08-09 | Global          | Inputs a 13-14px: iOS hace zoom al enfocar y deja la página desplazada                                                                     | corregido     | 16px para `input/textarea/select` (y `.av-search input`) solo en táctil                                                            |
| 2026-08-09 | `/games`        | Grid `minmax(280px,1fr)` y card de `cover-frogger` a 360px                                                                                 | ok            | Sin desborde; cover y botón JUGAR correctos                                                                                        |
| 2026-08-09 | `/about`        | Inputs fuera del viewport en el escaneo                                                                                                    | ok            | Falso positivo: honeypot anti-spam colocado fuera de pantalla a propósito                                                          |
| 2026-08-09 | `/`             | `.pc-stamp` sobresale de `.price-card` (sw 318 / cw 296)                                                                                   | ok            | Sello decorativo posicionado a propósito; queda dentro del viewport (R350 < 360)                                                   |
| 2026-08-09 | `/play/*`       | Landscape en teléfono: el cálculo del `.crt` no aplica (>720px de ancho) y la página se desborda en vertical                               | requiere-spec | Fuera de alcance de la spec 10; hace falta una orientación landscape propia del reproductor                                        |
| 2026-08-09 | `/play/*`       | Tablet táctil en portrait (768×1024): el gamepad acaba 9px por debajo del pliegue (constante 382 corta para tablets)                       | pendiente     | Al límite; retocar la constante >720 arrastraría al ajuste de la spec 11                                                           |

## Notas de escala de breakpoints (convergencia gradual)

- Objetivo: `520 / 720 / 900 / 1100`.
- Ya alineados: nav (840 → **900**), reglas nuevas del reproductor (**720** / **520**), salón (**520**).
- Aún fuera de escala (no tocados en esta pasada): `620` (variante compacta del gamepad MK-II),
  `600` (`.mini-rail`), `820` (`.highlight-row`), `980` (`.feature-grid`).

## Cómo audité (reproducible sin dependencias nuevas)

Chrome headless con `--remote-debugging-port=9222` manejado por CDP desde Node
(`WebSocket` global, sin paquetes): `Emulation.setDeviceMetricsOverride` (mobile:true) +
`Emulation.setTouchEmulationEnabled` dan `(hover: none) and (pointer: coarse)`, y luego se
mide `documentElement.scrollWidth` vs `innerWidth`, alturas del HUD/CRT/gamepad y targets
<44px. Ojo: `--window-size` del CLI de Chrome no baja de 500px; hay que usar CDP.
