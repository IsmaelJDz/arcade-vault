# SPEC 10 — Controles táctiles para los juegos reales (`/play/[id]`)

> **Contexto (por qué):** Los 4 juegos reales (`rocas`, `caida`, `bloque-buster`, `serpentina`)
> solo se controlan con teclado; en dispositivos táctiles el reproductor muestra el aviso
> `.keyboard-notice` ("requiere teclado") y los juegos son injugables. Queremos que se puedan
> jugar en móvil con un gamepad virtual en pantalla.

- **Estado:** Implementado
- **Depende de:** `01-visual-screens-app-router.md` (reproductor `/play/[id]`, `CrtBottom`),
  `05-asteroids-game.md`, `07-caida-game.md`, `08-bloque-buster-game.md`,
  `09-serpentina-game.md` (los 4 motores con listeners de teclado en `window` vía `e.code`).
- **Fecha:** 2026-08-02
- **Objetivo:** Agregar un gamepad virtual táctil (D-pad a la izquierda + botones de acción a la
  derecha, declarados por juego) en una franja debajo del CRT en `/play/[id]`, visible solo en
  dispositivos `(pointer: coarse)`, con multi-touch, conectado a los 4 motores mediante eventos
  de teclado sintéticos (sin tocar `lib/games/*`), reemplazando el aviso "requiere teclado".

---

## Alcance

### Dentro

- **Componente `app/play/[id]/touch-controls.tsx` (nuevo)** — gamepad virtual client-side:
  D-pad a la izquierda (solo las direcciones que el juego use) + botones de acción a la
  derecha (etiquetados por juego). Al pulsar/soltar emite eventos de teclado sintéticos
  (`window.dispatchEvent(new KeyboardEvent("keydown"/"keyup", { code }))`) — los 4 motores
  ya escuchan en `window` leyendo `e.code`, así que **no se toca `lib/games/*`**.
- **Multi-touch real** — cada control rastrea su propio pointer (Pointer Events:
  `pointerdown`/`pointerup`/`pointercancel`/salida del botón); mantener varios controles
  pulsados a la vez funciona (p.ej. rotar + propulsar + disparar en `rocas`).
- **Auto-repeat estilo teclado** — mientras un control se mantiene pulsado se reemiten
  `keydown` periódicos (delay inicial + intervalo), imitando el auto-repeat del teclado
  físico del que depende `caida` para mover en horizontal; inocuo para los otros motores
  (usan mapa de teclas presionadas o re-fijan dirección).
- **Layouts por juego** — mapa `TOUCH_LAYOUTS` (en el propio componente):
  - `rocas`: D-pad ← → ↑ + botón **DISPARAR** (`Space`).
  - `caida`: D-pad ← → ↓ + botones **ROTAR** (`ArrowUp`) y **CAER** (`Space`).
  - `bloque-buster`: D-pad ← → (sin botones).
  - `serpentina`: D-pad completo ← → ↑ ↓ (sin botones).
    Los controles que un juego no usa **no se renderizan**.
- **Integración en `app/play/[id]/page.tsx`** — los 4 Players reales renderizan
  `<TouchControls game={id} disabled={paused || over}>` en la franja debajo del CRT
  (zona de `CrtBottom`); `disabled` suelta cualquier tecla retenida y deja de emitir.
- **CSS `app/globals.css`** — estilos del gamepad (estética neon-arcade consistente);
  visible **solo** bajo `@media (hover: none) and (pointer: coarse)` (en desktop no existe);
  el aviso `.keyboard-notice` ("requiere teclado") **se elimina**. `touch-action: none`,
  `user-select: none` y bloqueo del menú contextual/long-press sobre los controles.

### Fuera

- Tocar los motores `lib/games/*` (cero cambios) y los wrappers `<slug>-game.tsx`.
- Gestos sobre el canvas (swipe/tap/drag) — spec futura si se quiere.
- Auditoría/rediseño responsive general del reproductor o del resto de la app (HUD,
  tamaños del CRT, orientación landscape, viewport).
- Juegos simulados (`SimulatedPlayer`) — siguen sin controles.
- Vibración háptica, sonidos de botón, remapeo/preferencias de controles, persistencia.
- Tests (no hay runner); cambios de DB/esquema (no aplica).

---

## Modelo de datos

**No introduce datos persistidos nuevos** (sin cambios en DB, sin migraciones, sin tipos
regenerados, sin `localStorage`). Lo único nuevo es la estructura de configuración del
gamepad, local al componente:

```ts
// app/play/[id]/touch-controls.tsx

type TouchDir = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

interface TouchAction {
  label: string; // texto del botón, p.ej. "DISPARAR"
  code: "Space" | "ArrowUp"; // e.code que emite
}

interface TouchLayout {
  dirs: TouchDir[]; // direcciones del D-pad que se renderizan
  actions: TouchAction[]; // botones de acción (derecha); [] = sin botones
}

const TOUCH_LAYOUTS: Record<string, TouchLayout> = {
  rocas: {
    dirs: ["ArrowLeft", "ArrowRight", "ArrowUp"],
    actions: [{ label: "DISPARAR", code: "Space" }],
  },
  caida: {
    dirs: ["ArrowLeft", "ArrowRight", "ArrowDown"],
    actions: [
      { label: "ROTAR", code: "ArrowUp" },
      { label: "CAER", code: "Space" },
    ],
  },
  "bloque-buster": { dirs: ["ArrowLeft", "ArrowRight"], actions: [] },
  serpentina: { dirs: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"], actions: [] },
};
```

Contrato del componente:

```ts
interface TouchControlsProps {
  game: string; // id del juego; si no está en TOUCH_LAYOUTS no renderiza nada
  disabled: boolean; // true en pausa/fin: emite keyup de lo retenido y bloquea nuevas pulsaciones
}
```

Convención de emisión: `keydown`/`keyup` sintéticos con `new KeyboardEvent(type, { code })`
despachados en `window`. Auto-repeat: tras el `keydown` inicial, delay ~350 ms y luego
reemisión cada ~120 ms mientras siga pulsado (timers limpiados en `keyup`/unmount/`disabled`).

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable.

1. **Componente `app/play/[id]/touch-controls.tsx`** — client component con `TOUCH_LAYOUTS`,
   D-pad (grid en cruz, solo `dirs` del juego) y botones de acción (`actions`). Por control:
   `onPointerDown` → `keydown` sintético + arranque del auto-repeat; `onPointerUp`/
   `onPointerCancel`/salida del botón → `keyup` + limpiar timers; `setPointerCapture` para no
   perder el dedo al deslizar. Multi-touch: estado por control, no global. `disabled` (y el
   unmount) emiten `keyup` de todo lo retenido y cancelan timers. `onContextMenu` prevenido.
   **Prueba:** `npm run build` compila; el componente no accede al DOM al importar.

2. **CSS `app/globals.css`** — bloque `.touch-controls` (franja bajo el CRT: D-pad izquierda,
   acciones derecha, estética neon-arcade: bordes glow, `kbd`-style), `touch-action: none`,
   `user-select: none`, `-webkit-tap-highlight-color: transparent`, estado `:active`/pulsado
   visible. Oculto por defecto; visible solo bajo `@media (hover: none) and (pointer: coarse)`.
   Eliminar la regla y el uso de `.keyboard-notice`. **Prueba:** en desktop nada cambia; con
   emulación táctil (DevTools) el gamepad aparece y el aviso de teclado ya no existe.

3. **Integración en `app/play/[id]/page.tsx`** — en los 4 Players reales (`AsteroidsPlayer`,
   `CaidaPlayer`, `BloqueBusterPlayer`, `SerpentinaPlayer`) renderizar
   `<TouchControls game="<id>" disabled={paused || over} />` en la franja debajo del CRT
   (junto a `CrtBottom`), y retirar el `.keyboard-notice` de la leyenda de controles.
   **Prueba:** con emulación táctil los 4 juegos responden al gamepad (cada uno con su layout).

4. **Pulido de input** — verificar: multi-touch en `rocas` (rotar + propulsar + disparar
   simultáneos), auto-repeat en `caida` (mantener ← desplaza en continuo), pausa/fin sueltan
   teclas retenidas (nada queda "pegado" al reanudar), sin scroll/zoom/long-press del
   navegador al machacar botones, y el teclado físico sigue funcionando igual en desktop.
   **Prueba:** checklist manual anterior completa.

5. **Verificación final** — `npm run build` + `npm run lint`. Recorrido en dispositivo real
   (red local, como la captura de referencia): `/play/rocas`, `/play/caida`,
   `/play/bloque-buster`, `/play/serpentina` jugables de inicio a fin con el gamepad —
   partida completa, pausa, fin, guardar score. **Prueba:** recorrido completo en móvil.

---

## Criterios de aceptación

**Build e integración**

- [x] `npm run build` y `npm run lint` sin errores.
- [x] `lib/games/*` y los wrappers `<slug>-game.tsx` quedan sin cambios (`git diff` limpio en esos paths).
- [x] En desktop (pointer fino) el gamepad no se renderiza visible y el juego con teclado físico funciona igual que antes.
- [x] El aviso `.keyboard-notice` ("requiere teclado") ya no existe en código ni en pantalla.

**Gamepad por juego (en dispositivo/emulación táctil)**

- [x] `rocas`: D-pad ← → ↑ + DISPARAR; rotar + propulsar + disparar a la vez (multi-touch) funciona.
- [x] `caida`: D-pad ← → ↓ + ROTAR + CAER; mantener ←/→ desplaza en continuo (auto-repeat); ↓ acelera la caída.
- [x] `bloque-buster`: solo ← →; mantener pulsado mueve el paddle en continuo.
- [x] `serpentina`: D-pad de 4 direcciones; un tap cambia la dirección; el giro de 180° sigue bloqueado.
- [x] Ningún juego muestra controles que no usa (sin botones vacíos ni direcciones muertas).

**Comportamiento del input**

- [x] Pulsar/soltar un control equivale a `keydown`/`keyup` del teclado; el control permanece
      activo mientras el dedo siga apoyado (aunque se deslice fuera del botón) y se suelta al
      levantarlo (`pointerup`/`pointercancel`).
- [x] PAUSA o FIN con un control retenido: se emite su `keyup`; al reanudar nada queda "pegado".
- [x] Machacar botones no provoca scroll, zoom, selección de texto ni menú de long-press.
- [x] Navegar fuera de `/play/[id]` con controles pulsados no deja timers ni teclas retenidas.

**Recorrido final**

- [x] En un móvil real: partida completa en cada uno de los 4 juegos usando solo el gamepad, incluyendo pausa, fin y guardado de score.

---

## Decisiones (elegido vs descartado)

- **Gamepad virtual con botones en pantalla** (No: gestos swipe/tap/drag sobre el canvas —
  posible spec futura; se prefirió botones por consistencia entre juegos, descubribilidad y
  estética arcade). Layout basado en el boceto del usuario: D-pad izquierda + acciones derecha.
- **Franja dedicada debajo del CRT** (No: overlay semitransparente sobre el canvas — taparía
  el área de juego en un canvas 4:3 que ya es pequeño en portrait).
- **Eventos de teclado sintéticos en `window`** (No: API de input nueva `press()/release()`
  en cada motor — verificado que los 4 motores escuchan en `window` leyendo `e.code`, así que
  la vía sintética deja `lib/games/*` intacto).
- **Layout declarado por juego en `TOUCH_LAYOUTS`, controles no usados ocultos** (No: gamepad
  fijo idéntico con botones muertos).
- **Deslizar el dedo fuera del botón NO lo suelta: la captura del pointer lo mantiene activo
  hasta levantar el dedo** (No: soltar en `pointerleave` — la captura implícita del touch y
  `setPointerCapture` impiden que ese evento dispare; verificado en emulación durante el Paso 4
  y decidido por el usuario).
- **Multi-touch real con Pointer Events + estado por control** (No: un solo toque a la vez —
  `rocas` lo necesita para jugarse bien).
- **Auto-repeat sintético (delay + intervalo)** (No: depender del auto-repeat del SO, que no
  existe en eventos sintéticos — `caida` mueve una celda por `keydown` y lo requiere).
- **Visible solo en `(hover: none) and (pointer: coarse)`** (No: siempre visible con toggle).
- **Eliminar `.keyboard-notice`** (No: mantenerlo junto al gamepad — sería contradictorio).
- **Un solo componente compartido `touch-controls.tsx`** (No: un componente por juego —
  el layout es el mismo patrón parametrizado).
- **Alcance limitado al input táctil** (No: incluir auditoría responsive del reproductor —
  decidido explícitamente por el usuario; si el layout móvil necesita ajustes, será otra spec).

---

## Riesgos

| Riesgo                                                                                                     | Mitigación                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Eventos sintéticos con `isTrusted: false` ignorados por algún handler                                      | Verificado: los 4 motores solo leen `e.code`, sin chequear `isTrusted`; criterio de aceptación lo cubre por juego.                                                             |
| Tecla "pegada" (keydown sin keyup) al pausar, terminar o desmontar con el dedo puesto                      | `disabled` y el cleanup del unmount emiten `keyup` de todo lo retenido y cancelan los timers de auto-repeat.                                                                   |
| El dedo se desliza fuera del botón                                                                         | Decisión: la captura del pointer mantiene el control activo hasta levantar el dedo (`pointerup`/`pointercancel`); `pointerleave` queda solo como fallback si la captura falla. |
| Gestos del navegador móvil (scroll, double-tap zoom, long-press, selección) al machacar botones            | `touch-action: none`, `user-select: none`, `-webkit-tap-highlight-color: transparent`, `onContextMenu` prevenido sobre la franja de controles.                                 |
| Auto-repeat sintético altera un motor que no lo espera                                                     | Verificado: `rocas`/`bloque-buster` usan mapa de teclas (repeats inocuos), `serpentina` re-fija dirección (idempotente), `caida` lo necesita.                                  |
| Laptops con pantalla táctil muestran el gamepad en desktop                                                 | Media query combinada `(hover: none) and (pointer: coarse)` — solo dispositivos puramente táctiles.                                                                            |
| Dos controles emitiendo el mismo `code` (no ocurre en los layouts actuales, pero podría en futuros juegos) | Convención documentada en el componente: un `code` por control en cada layout.                                                                                                 |
