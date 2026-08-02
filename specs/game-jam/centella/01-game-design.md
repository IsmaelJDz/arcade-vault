# SPEC centella/01 — CENTELLA: diseño del juego

> **Estado:** Draft
> **Depende de:** `specs/01-visual-screens-app-router.md` (reproductor `/play/[id]`, `PlayerHud`, `saveScore`), `specs/05-asteroids-game.md` (patrón motor + wrapper + `Player`), `specs/06-games-scores-leaderboard.md` (tablas `games`/`scores`, Hall), `lib/games.ts` (catálogo y tipos)
> **Fecha:** 2026-08-02
> **Objetivo:** Definir el diseño completo de CENTELLA, un crossing arcade infinito original para el jam "Cruza la carretera y el río sin convertirte en papilla", diferenciado de `ranaria` y del resto del catálogo.

---

## Concepto y encaje con el tema del jam

**Tema del jam:** "Cruza la carretera y el río sin convertirte en papilla" (estilo Frogger).

**Pitch:** Eres una **centella** — una chispa de luz fugada de la red eléctrica — que huye hacia arriba por una autopista de datos **infinita y procedural**. Alternas carriles de tráfico letal, ríos de plasma que solo se cruzan sobre **placas flotantes** a la deriva, y franjas seguras con orbes de bonus. Desde abajo sube sin pausa una **marea de estática** que te obliga a avanzar. Tu única ventaja: el **parpadeo**, un teletransporte de 2 filas con cooldown que atraviesa cualquier cosa… pero no perdona un mal aterrizaje.

**Cómo responde al tema:** cruzar carretera (carriles de coches letales) + cruzar río (placas flotantes que te arrastran; el plasma es papilla instantánea) + zonas seguras que puntúan. Es exactamente el fantasma del tema, con giro propio.

**Cómo se diferencia de `ranaria` (Frogger del catálogo) y del resto:**

| `ranaria` (catálogo, simulado)       | CENTELLA (este jam)                                                 |
| ------------------------------------ | ------------------------------------------------------------------- |
| Pantallas fijas con meta (nenúfares) | Mundo **infinito procedural**, sin meta: sobrevive y avanza         |
| Temporizador por pantalla            | **Marea de estática** que sube y te alcanza si te estancas          |
| Solo saltos de 1 celda               | Saltos de 1 celda **+ parpadeo** (teletransporte 2 filas, cooldown) |
| Score por llegar a la meta           | Score por **fila récord** + orbes + niveles sin tope                |

Ningún otro juego del catálogo (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `duelo-pixel`) comparte el loop de "cruzar bandas de peligro con scroll de mundo". No hay jams previos en `specs/game-jam/`.

---

## Mecánicas y loop de juego

### Mundo

- Grilla de **20 columnas** (celda 40 px) y filas infinitas hacia arriba; el canvas muestra **15 filas** (800×600 interno).
- La **fila 0** es el arranque; la cámara sigue la fila récord del jugador y sube con él (el mundo por debajo queda atrás y acaba tragado por la marea).
- Generación **procedural por bloques** de filas (ver `02-engine.md` para números): tras cada franja segura viene un bloque de carretera (2–4 filas) o de río (2–3 filas); siempre hay una franja segura entre bloques.

### Tipos de fila

1. **SEGURA** — asfalto neutro. Al pisarla se registra como último punto de reaparición. Puede contener **1 orbe** de bonus (+50) recogible al pisarlo.
2. **CARRETERA** — un carril de coches por fila; dirección alterna por carril, velocidad y densidad variables. Tocar un coche = perder vida.
3. **RÍO** — plasma letal; solo se pisa sobre **placas flotantes** (2–4 celdas de largo) que arrastran al jugador con su deriva. Pisar plasma sin placa, o salir del canvas arrastrado por una placa = perder vida.

### La marea de estática

- Banda de ruido que sube desde abajo a velocidad constante (crece con el nivel).
- Si su borde superior alcanza al jugador → pierde una vida.
- Tras cada muerte, la marea se reposiciona 6 filas por debajo del punto de reaparición: castiga sin ser injusta.
- Es el sustituto del temporizador clásico: presión continua, visible y espacial.

### El parpadeo (mecánica firma)

- **Espacio**: teletransporte instantáneo **2 filas hacia adelante**, misma columna, atravesando coches y plasma durante el destello.
- **Cooldown 5 s**. El estado se comunica **dentro del mundo**: el aura del jugador brilla cuando está cargado y queda apagada mientras recarga (el motor no dibuja HUD, pero el aura es parte del sprite).
- El aterrizaje **aplica las reglas normales de la celda destino**: caer en plasma sin placa o quedar bajo un coche sigue siendo papilla. Riesgo/recompensa puro: salvarte de un carril imposible o suicidarte con estilo.

### Vidas y muerte

- **3 vidas.** Al morir: estallido breve, reaparición en la **última fila SEGURA visitada** (columna central), **1.5 s de invulnerabilidad** (sprite parpadeando), marea reposicionada.
- Vidas a 0 → game over (modal de FIN de la plataforma).

### Loop de juego

Avanzar filas → sortear carretera → cruzar río sobre placas → pisar segura (checkpoint + posible orbe) → la marea aprieta → gastar o guardar el parpadeo → subir de nivel → todo más rápido → morir → guardar score → otra vez.

---

## Puntuación, niveles y dificultad

- **+10** por cada **fila récord** nueva (solo la primera vez que se alcanza esa fila; retroceder no resta ni re-puntúa).
- **+50** por orbe recogido.
- **Nivel** = `floor(filaRecord / 20) + 1`, sin tope.
- Curva: por nivel, velocidad de coches y placas **×1.08 acumulado** y marea **×1.10 acumulado**, ambos con tope ×2.5 (el juego termina siendo frenético pero legible). La densidad de coches también sube levemente (ver 02).
- Score competitivo y monótono creciente → apto para el leaderboard del Hall.

---

## Controles

| Tecla           | Acción                                          |
| --------------- | ----------------------------------------------- |
| `↑` `↓` `←` `→` | Salto de 1 celda en esa dirección               |
| `Espacio`       | Parpadeo (teletransporte 2 filas, cooldown 5 s) |

- Solo teclado (5 teclas); en móvil se muestra el aviso "requiere teclado" existente.
- Leyenda de controles del reproductor: `◄ ▲ ▼ ► SALTAR · ESPACIO PARPADEO`.
- Sin tecla de pausa propia: la pausa la controla el botón PAUSA de la plataforma.

---

## HUD (React, fuera del canvas)

- Reusa `PlayerHud` con la variante **Vidas** en el slot central (prop `lives`, corazones), igual que `rocas`/`bloque-buster`: PUNTOS / **VIDAS** / NIVEL.
- Handlers que implica el motor: `onScore`, `onLives`, `onLevel`, `onGameOver` (contrato completo en `02-engine.md`).
- El motor **no** dibuja HUD ni overlays de PAUSA/GAME OVER; el único indicador in-canvas es el aura de cooldown del parpadeo (parte del sprite del jugador).

---

## Estética vector-neón

Todo con `fillRect`/`arc` + `shadowBlur`; **sin sprites ni imágenes**.

- **Fondo:** `#05060c`.
- **Carretera:** bandas `#0b0d16` con líneas discontinuas cian tenue (`rgba(41,243,255,.15)`).
- **Río:** `#041018` con ondas horizontales cian animadas de baja opacidad.
- **Franja segura:** `#101322` con borde superior/inferior verde tenue (`rgba(56,255,154,.25)`).
- **Jugador:** rombo/chispa **magenta** `#ff3df0` con núcleo blanco y glow; aura exterior = estado del parpadeo.
- **Coches:** rectángulos 1–2 celdas con glow, color alternando por carril: cian `#29f3ff`, amarillo `#ffe14d`, verde `#38ff9a`.
- **Placas:** rectángulos cian oscuro `#0a2a33` con borde cian brillante.
- **Orbes:** círculos amarillos pulsantes con glow.
- **Marea:** banda de estática magenta/blanca (líneas horizontales aleatorias) con borde superior brillante `#ff3df0`.

---

## Identidad de catálogo propuesta

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
}
```

- `sort`: **9** en `public.games` (el catálogo actual usa 1–8).
- `color: "magenta"` — solo `caida` lo usa hoy; equilibra la paleta del grid y casa con el sprite del jugador.
- `id` verificado: no existe en `lib/games.ts` ni como carpeta previa en `specs/game-jam/`.

---

## Decisiones (Sí / No)

- **Sí:** Mundo infinito procedural con marea que empuja.
  - **No:** pantallas fijas con nenúfares y temporizador (sería duplicar `ranaria`).
- **Sí:** Parpadeo (Espacio) con cooldown de 5 s y aterrizaje bajo reglas normales.
  - **No:** parpadeo invulnerable también al aterrizar (mataría el riesgo/recompensa) ni cargas acumulables (complica el HUD).
- **Sí:** Comunicar el cooldown con el aura del jugador dentro del canvas.
  - **No:** añadir un slot nuevo al `PlayerHud` (exigiría tocar el componente compartido para un solo juego).
- **Sí:** 3 vidas + checkpoint en la última fila segura + 1.5 s de invulnerabilidad al reaparecer.
  - **No:** una sola vida (partidas demasiado cortas para un endless con leaderboard) ni respawn en la fila 0 (castigo desproporcionado).
- **Sí:** Score por fila récord (+10) — solo primera vez por fila.
  - **No:** score por fila pisada (farmearía puntos oscilando arriba/abajo).
- **Sí:** Vector-neón puro (`fillRect`/`arc` + glow), sin assets.
  - **No:** spritesheets (no hay justificación; `serpentina` lo tuvo por assets heredados).
- **Sí:** Slot central del HUD = **Vidas** (variante existente de `PlayerHud`).
  - **No:** mostrar "Filas" en el slot central (redundante con el score, que ya deriva de las filas).
- **Sí:** Sin sonido en v1.
  - **No:** portar/crear efectos de audio (fuera de alcance del jam; `bloque-buster` los tuvo por assets heredados).
- **Sí:** Nivel sin tope con multiplicadores capados a ×2.5.
  - **No:** dificultad infinita sin cap (a partir de cierta velocidad los saltos por celda se vuelven ilegibles).

---

## Criterios de aceptación de diseño

- [ ] El juego responde al tema del jam: carretera letal + río con plataformas flotantes + zonas seguras que puntúan.
- [ ] No duplica mecánicas de `ranaria` ni de ningún juego de `lib/games.ts` (tabla de diferenciación arriba).
- [ ] Score competitivo, monótono creciente, apto para el Hall of Fame.
- [ ] Controles: solo flechas + Espacio; aviso "requiere teclado" en móvil.
- [ ] Estética 100 % vector-neón, sin imágenes.
- [ ] HUD encaja en `PlayerHud` existente (PUNTOS / VIDAS / NIVEL) sin modificar el componente.
- [ ] El motor cabe en el contrato `initCentella(canvas, handlers) → { destroy, setPaused, restart }`.
- [ ] `game-id` `centella` libre en catálogo y en jams previos.
- [ ] La marea garantiza que ninguna partida es infinita por inacción (siempre hay game over).

---

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                               |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Se percibe como "otro Frogger" y roza a `ranaria`.                             | Diferenciadores duros: infinito procedural, marea, parpadeo, score por fila récord. Tabla comparativa.   |
| El generador procedural crea pasajes imposibles (ríos sin placas alcanzables). | Reglas de generación con gaps máximos y franjas seguras obligatorias entre bloques (números en 02).      |
| El parpadeo trivializa el juego (saltarse todos los peligros).                 | Cooldown de 5 s + aterrizaje bajo reglas normales + solo 2 filas de alcance.                             |
| El cooldown in-canvas (aura) pasa desapercibido.                               | Contraste fuerte: aura blanca brillante cargado vs. sprite apagado recargando; parpadeo al recargarse.   |
| La marea frustra a jugadores nuevos.                                           | Velocidad base baja (alcanza a un jugador quieto en ~15 s), reposicionamiento generoso tras cada muerte. |
| Farmeo de score oscilando entre filas.                                         | +10 solo por fila récord nueva; los orbes desaparecen al recogerse.                                      |
