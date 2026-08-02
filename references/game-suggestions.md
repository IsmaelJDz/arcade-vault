# Historial de sugerencias de juegos — Arcade Vault

Registro de todo lo ya evaluado por el agente **game-planner** (memoria canónica en `.claude/agents/memory/game-planner.md`). Al pedir nuevas sugerencias, **no repetir nada de este archivo**: ni implementados, ni rechazados, ni ya sugeridos.

Última actualización: 2026-08-01

## Implementados

| Slug | Original | Spec |
| --- | --- | --- |
| `rocas` | Asteroids | 05 |
| `caida` | Tetris | 07 |
| `bloque-buster` | Arkanoid | 08 |
| `serpentina` | Snake | 09 |

## Sugeridos — placeholders del catálogo (cover/DB ya listos)

| Slug | Original | Nota |
| --- | --- | --- |
| `invasores` | Space Invaders | **Recomendación principal**: port simple, HUD Vidas. Sin fuente en `references/started-games/` — crearla primero. |
| `gloton` | Pac-Man | Alternativa en cola: icónico, pero port complejo (laberinto + IA de 4 fantasmas). |
| `ranaria` | Frogger | Alternativa en cola: variedad ARCADE, complejidad media. |
| `duelo-pixel` | Pong | Baja prioridad: score VERSUS poco natural para leaderboard creciente. |

## Sugeridos — 2026-08-01 (ronda de 20, por segmento)

### SHOOTER

| Slug | Original | Complejidad | Nota |
| --- | --- | --- | --- |
| `ciempies` | Centipede | Media | Cadena que serpentea entre hongos; score infinito por oleadas. |
| `comando-misil` | Missile Command | Baja/media | Interceptar misiles; HUD central = Ciudades. |
| `enjambre` | Galaga | Media | Picadas con curvas; mecánica hermana de `invasores`. |
| `escuadron` | 1942 | Media/alta | Scroll vertical + formaciones. |
| `caverna` | Scramble | Media/alta | Scroll lateral + gestión de fuel. |

### PUZZLE

| Slug | Original | Complejidad | Nota |
| --- | --- | --- | --- |
| `burbujas` | Puzzle Bobble | Media | Clusters de color + techo que baja. |
| `fusion` | 2048 | Baja | Port más barato del lote; score nativo acumulativo. |
| `gelatina` | Puyo Puyo | Media | Combos en cadena; distinto de `caida`. |
| `cinta` | Klax | Media | Tríos de color sobre cinta transportadora. |
| `flujo` | Pipe Mania | Media | Tuberías contra reloj. |

### LABERINTO / PLATAFORMAS

| Slug | Original | Complejidad | Nota |
| --- | --- | --- | --- |
| `excavador` | Dig Dug | Media | Cavar túneles; no solapa con `gloton`. |
| `bombardero` | Bomberman | Media | Bombas en grilla, score-attack en solitario. |
| `piramide` | Q\*bert | Media | Isométrico dibujado; lógica de grilla triangular. |
| `gemas` | Boulder Dash | Media-alta | Gravedad de rocas por celdas. |
| `barriles` | Donkey Kong | Alta | Icónico pero el más caro (físicas de salto). |

### ACCIÓN / MISC

| Slug | Original | Complejidad | Nota |
| --- | --- | --- | --- |
| `aleteo` | Flappy Bird | Baja | Un solo input; ideal port rápido. |
| `ascenso` | Doodle Jump | Media | Score = altura; muy competitivo. |
| `alunizaje` | Lunar Lander | Media | Reusa física de `rocas`; HUD = Combustible. |
| `blindados` | Tanks/Combat | Media | Arena top-down + IA simple. |
| `secuencia` | Simon | Baja | Máquina de estados, sin física. |

## Rechazados

| Slug | Original | Motivo |
| --- | --- | --- |
| `racing-sprint` | Sprint (racing top-down) | Complejidad alta, score débil para leaderboard. |
