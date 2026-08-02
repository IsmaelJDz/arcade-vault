# SPEC 11 — Apariencia MK-II del gamepad táctil

> **Estado:** Aprobado
> **Depende de:** `10-controles-tactiles.md` (gamepad táctil funcional en `/play/[id]`)
> **Fecha:** 2026-08-02
> **Objetivo:** Restylear el gamepad táctil de `/play/[id]` con la estética del
> Gamepad MK-II de `references/gamepad-assets/` (placa contenedora neon, D-pad con
> hub LED, botones circulares A/B con etiqueta) sin cambiar su comportamiento.

---

## Alcance

### Dentro

- **Markup de `app/play/[id]/touch-controls.tsx`** — reestructurar el render al patrón
  MK-II de `references/gamepad-assets/gamepad.html`: placa contenedora (marco redondeado
  con doble borde neon, gradiente y textura de puntos), D-pad de teclas cuadradas con
  flechas SVG, hub central con gema LED pulsante (**siempre presente**, aunque el layout
  no tenga las 4 direcciones), y botones de acción circulares con letra **A**/**B**
  dentro + mini-etiqueta de la acción debajo ("DISPARAR", "ROTAR", "CAER").
- **Convención de letras/colores** — `Space` → **A** (magenta, a la derecha);
  `ArrowUp` como acción → **B** (cyan, a la izquierda). Igual que la referencia:
  B a la izquierda de A.
- **CSS `app/globals.css`** — reemplazar el bloque `.touch-controls` actual por los
  estilos MK-II adaptados del `<style>` de la referencia (placa, teclas `dp`, hub/gema,
  botones `ab`, estados pressed con glow y hundimiento), usando los tokens ya existentes
  del tema (`--cyan`, `--magenta`, `--pixel`, etc.) y su variante compacta para
  pantallas angostas.
- **Ajuste del cálculo `.crt`** — si la nueva franja cambia de altura, corregir el
  `max-width: calc((100dvh - 372px) * 4 / 3)` (solo bajo la media query táctil si hace
  falta) para que el reproductor siga sin scroll vertical en portrait.

### Fuera

- **Comportamiento del gamepad (spec 10) — cero cambios**: eventos de teclado
  sintéticos, auto-repeat, multi-touch, pointer capture (deslizar fuera NO suelta),
  `disabled` en pausa/fin. El `pointerleave` de la referencia se ignora.
- Resaltar botones al pulsar teclas físicas (lo hace el `gamepad.html`; aquí no aplica).
- Mostrar el gamepad en desktop — sigue solo bajo `(hover: none) and (pointer: coarse)`.
- `lib/games/*`, wrappers `<slug>-game.tsx` y `page.tsx` — sin cambios.
- Cargar las Google Fonts de la referencia — se usan las fuentes ya presentes en la app.
- Sonidos de botón, háptica, skins del gamepad, gestos sobre el canvas.

---

## Modelo de datos

**No introduce datos persistidos** (sin DB, sin `localStorage`, sin cambios de tipos).
`TOUCH_LAYOUTS` y el contrato `TouchControlsProps` de la spec 10 quedan igual. Lo único
nuevo es el mapeo visual de acciones, local al componente:

```ts
// app/play/[id]/touch-controls.tsx

// Cada `code` de acción tiene letra y color fijos (convención MK-II):
const ACTION_STYLES: Record<TouchAction["code"], { letter: "A" | "B"; tone: "a" | "b" }> = {
  Space: { letter: "A", tone: "a" }, // magenta, siempre a la derecha
  ArrowUp: { letter: "B", tone: "b" }, // cyan, siempre a la izquierda de A
};
```

Convenciones:

- Orden de render: **B a la izquierda, A a la derecha** (como la referencia); con una
  sola acción (`rocas`) solo se renderiza A.
- La mini-etiqueta bajo cada círculo sale del `label` ya existente en `TOUCH_LAYOUTS`.
- El hub con gema es decorativo (`aria-hidden`), sin estado ni interacción.

---

## Plan de implementación

Cada paso deja el sistema compilando y jugable.

1. **Markup MK-II en `touch-controls.tsx`** — reestructurar el render: wrapper de placa
   (`.touch-shell`), D-pad con flechas SVG (reemplazan los glifos de texto ◄►▲▼) + hub
   con gema (`aria-hidden`), y acciones como círculo con letra (vía `ACTION_STYLES`,
   orden B→A) + mini-etiqueta debajo. Mismas classes base (`.touch-controls`,
   `.touch-dir-*`, `.pressed`) para que el CSS actual siga aplicando y el gamepad
   quede funcional aunque aún sin el look final. **Prueba:** `npm run build`; en
   emulación táctil los 4 juegos responden igual que antes.
2. **CSS de placa y D-pad en `globals.css`** — sustituir el bloque `.touch-controls`:
   placa (gradiente, doble borde, textura de puntos, sombra neon), teclas del D-pad
   estilo tecla física (relieve, hundimiento al pulsar, glow cyan en `.pressed`), hub
   con gema pulsante (`@keyframes`). **Prueba:** en emulación táctil el D-pad luce
   como `gamepad-neon.png` y el estado pulsado brilla/hunde.
3. **CSS de botones A/B + variante compacta** — círculos con gradiente radial, anillo,
   glow por tono (A magenta / B cyan), letra en fuente pixel, mini-etiqueta debajo;
   ajustes compactos para pantallas angostas (~≤620 px, como la referencia).
   **Prueba:** `caida` muestra B (ROTAR) y A (CAER); `rocas` solo A (DISPARAR);
   `bloque-buster`/`serpentina` sin botones; nada se desborda a 360 px.
4. **Altura de la franja y cálculo `.crt`** — medir la nueva altura del gamepad y, si
   cambió, ajustar el `calc((100dvh - 372px) * 4 / 3)` bajo la media query táctil para
   que el reproductor completo (HUD + CRT + gamepad) quepa sin scroll en portrait.
   **Prueba:** los 4 juegos sin scroll vertical en viewport móvil (p. ej. 390×844).
5. **Verificación final** — `npm run build` + `npm run lint`; checklist de
   comportamiento de la spec 10 intacta: multi-touch en `rocas`, auto-repeat en
   `caida`, pausa/fin sueltan teclas, deslizar fuera no suelta, desktop sin cambios.
   **Prueba:** checklist completa en emulación y build/lint verdes.

---

## Criterios de aceptación

**Build e integración**

- [ ] `npm run build` y `npm run lint` sin errores.
- [ ] `lib/games/*`, los wrappers `<slug>-game.tsx` y `page.tsx` quedan sin cambios
      (`git diff` limpio en esos paths).
- [ ] En desktop (pointer fino) el gamepad sigue sin renderizarse y el teclado físico
      funciona igual que antes.

**Apariencia MK-II (en emulación/dispositivo táctil)**

- [ ] La franja muestra la placa contenedora (marco redondeado, doble borde neon,
      gradiente oscuro y textura de puntos) equivalente a `gamepad-neon.png`.
- [ ] D-pad de teclas cuadradas con flechas SVG y relieve; al pulsar, la tecla se hunde
      y brilla en cyan.
- [ ] El hub central con gema LED pulsante aparece en los 4 juegos, incluidos los de
      layout parcial (`bloque-buster`, `rocas`).
- [ ] Botones de acción circulares: A magenta con glow, B cyan con glow, letra en
      fuente pixel y mini-etiqueta de la acción debajo; al pulsar se hunden y aumenta
      el glow.
- [ ] `caida` muestra B (ROTAR) a la izquierda y A (CAER) a la derecha; `rocas` solo
      A (DISPARAR); `bloque-buster` y `serpentina` no muestran botones de acción.
- [ ] A 360 px de ancho nada se desborda ni provoca scroll horizontal.

**Comportamiento intacto (spec 10)**

- [ ] Multi-touch en `rocas` (rotar + propulsar + disparar a la vez) sigue funcionando.
- [ ] Auto-repeat en `caida` (mantener ←/→) sigue funcionando.
- [ ] PAUSA/FIN con un control retenido lo suelta; nada queda "pegado" al reanudar.
- [ ] Deslizar el dedo fuera de un botón NO lo suelta (pointer capture).
- [ ] En portrait móvil (p. ej. 390×844) el reproductor completo (HUD + CRT + gamepad)
      cabe sin scroll vertical en los 4 juegos.

---

## Decisiones (elegido vs descartado)

- **Placa contenedora completa estilo MK-II** (No: solo restylear botones sueltos —
  la placa es lo que da la identidad visual de la referencia; se hace compacta para
  no robar altura al CRT).
- **Círculo A/B + mini-etiqueta debajo** (No: solo letra, fidelidad total — perdería
  la descubribilidad de qué hace cada botón; No: texto dentro del círculo — no cabe
  en fuente pixel sin romper el círculo).
- **Convención fija de letras/colores: `Space` → A magenta, `ArrowUp` → B cyan, B a la
  izquierda de A** (No: letras por posición en el array — la convención por `code` hace
  que "A = acción principal" sea consistente entre juegos).
- **Hub con gema siempre visible, en todos los layouts** (No: solo con cruz completa —
  mantiene la silueta MK-II uniforme entre juegos; las direcciones ausentes simplemente
  no se renderizan).
- **Flechas SVG inline** (No: conservar los glifos de texto ◄►▲▼ — la referencia usa
  triángulos SVG con `drop-shadow`; los glifos varían entre plataformas móviles).
- **Solo apariencia: el comportamiento de la spec 10 queda intacto** (No: adoptar el
  `pointerleave` que suelta el botón en el `gamepad.html` de referencia — contradice
  la decisión explícita de la spec 10 de mantener activo con pointer capture).
- **Tokens y fuentes ya existentes del tema** (No: cargar las Google Fonts del
  standalone — `--pixel`/`--mono`/`--cyan`/`--magenta` ya existen en `globals.css`
  con los mismos valores).
- **Visible solo bajo `(hover: none) and (pointer: coarse)`, sin resaltado por teclado
  físico** (No: replicar el resaltado por teclado de la referencia — solo tendría
  sentido si el gamepad se mostrara en desktop, y no se muestra).

---

## Riesgos

| Riesgo                                                                                                                            | Mitigación                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La placa + mini-etiquetas aumentan la altura de la franja y el reproductor deja de caber sin scroll en portrait (o encoge el CRT) | Paso 4 del plan: medir la altura nueva y ajustar el `calc((100dvh - 372px) * 4 / 3)` bajo la media query táctil; placa en versión compacta desde el inicio. |
| Los pseudo-elementos decorativos de la placa (`::before`/`::after` de borde y textura) interceptan los toques sobre los botones   | `pointer-events: none` en ambos, igual que en el `gamepad.html` de referencia.                                                                              |
| La animación infinita de la gema y los `drop-shadow` compiten con el render del canvas en móviles modestos                        | Animar solo `opacity`/`transform` (composited); respetar `prefers-reduced-motion` desactivando el pulso.                                                    |
| Reestructurar el markup rompe el gamepad a mitad de implementación                                                                | Paso 1 conserva las classes base (`.touch-controls`, `.touch-dir-*`, `.pressed`) para que el CSS vigente siga aplicando hasta que llegue el CSS MK-II.      |
