# Juegos implementados

Juegos con port real (motor `lib/games/<slug>.ts` + wrapper `app/play/[id]/<slug>-game.tsx` + branch en `page.tsx`). El resto del catálogo sigue en `SimulatedPlayer`.

| # | Slug | Título | Clásico | Categoría | Color | Motor |
|---|------|--------|---------|-----------|-------|-------|
| 1 | `bloque-buster` | BLOQUE BUSTER | Arkanoid | ARCADE | cyan | `lib/games/bloque-buster.ts` |
| 2 | `caida` | CAÍDA | Tetris | PUZZLE | magenta | `lib/games/caida.ts` |
| 3 | `serpentina` | SERPENTINA | Snake | ARCADE | green | `lib/games/serpentina.ts` |
| 4 | `rocas` | ROCAS | Asteroids | SHOOTER | yellow | `lib/games/asteroids.ts` |

## Detalle

### BLOQUE BUSTER (`bloque-buster`) — Arkanoid
Rebota la pelota y destruye muros de neón. Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles.
- Categoría: ARCADE · Color: cyan · Cover: `cover-bricks`
- Motor: `lib/games/bloque-buster.ts` · Wrapper: `app/play/[id]/bloque-buster-game.tsx`

### CAÍDA (`caida`) — Tetris
Encaja las piezas antes de que el techo te aplaste. Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta cada 10 líneas.
- Categoría: PUZZLE · Color: magenta · Cover: `cover-tetro`
- Motor: `lib/games/caida.ts` · Wrapper: `app/play/[id]/caida-game.tsx`

### SERPENTINA (`serpentina`) — Snake
Devora frutas de neón y crece sin morderte. Una serpiente de luz recorre la grilla devorando frutas; cada bocado la alarga y la acelera. Un movimiento en falso —contra el muro o tu propia cola— y se acabó.
- Categoría: ARCADE · Color: green · Cover: `cover-snake`
- Motor: `lib/games/serpentina.ts` · Wrapper: `app/play/[id]/serpentina-game.tsx`

### ROCAS (`rocas`) — Asteroids
Pulveriza asteroides en gravedad cero. Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs.
- Categoría: SHOOTER · Color: yellow · Cover: `cover-rocas`
- Motor: `lib/games/asteroids.ts` · Wrapper: `app/play/[id]/asteroids-game.tsx`

## Catálogo pendiente (aún simulados)

Presentes en `public.games` pero sin motor real todavía:

| Slug | Título | Clásico | Categoría |
|------|--------|---------|-----------|
| `gloton` | GLOTÓN | Pac-Man | ARCADE |
| `invasores` | INVASORES | Space Invaders | SHOOTER |
| `ranaria` | RANARIA | Frogger | ARCADE |
| `duelo-pixel` | DUELO PIXEL | Pong | VERSUS |
