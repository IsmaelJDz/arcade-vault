---
name: spec-impl-game
description: Implementa una spec aprobada igual que /spec-impl (valida que el estado signifique "Approved", crea la rama spec-NN-slug e implementa paso a paso pausando tras cada paso) y, al terminar el plan, dispara en secuencia los agentes skin-designer y luego mobile-porter para dejar skins y responsive verificados.
disable-model-invocation: true
argument-hint: <NN-slug>
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(git add:*), Bash(cat:*), Bash(ls:*), Bash(npm run build:*), Bash(npm run lint:*)
---

# /spec-impl-game — Implementador de specs aprobadas + pulido automático

Mismo flujo que `/spec-impl` (identificar spec → validar estado → crear rama → implementar paso a
paso con pausas) y, al completar el plan, una **Fase 5** que lanza en secuencia los agentes
`skin-designer` y `mobile-porter` del repo para dejar skins y responsive verificados antes de cerrar
la rama.

## Contexto de sesión

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Specs disponibles:
!`ls specs/ 2>/dev/null || echo "No existe la carpeta specs/"`

Config de creación de rama:
!`cat specs/.spec-config.yml 2>/dev/null || echo "AutoCreateBranch: true (default, sin archivo de config)"`

---

## Instrucciones

Sigue estas cinco fases en orden estricto. **No avances si la anterior no se completó
correctamente.** Responde en español.

---

### Fase 1 — Identificar la spec

El argumento recibido es: `$ARGUMENTS`

Si `$ARGUMENTS` está vacío:

- Lista las specs disponibles (ya las tienes arriba).
- Pide al usuario el nombre exacto de la spec.
- **Detente y espera respuesta.** No continúes.

Si `$ARGUMENTS` tiene valor:

- Busca el archivo en `specs/`. El usuario puede haber escrito el nombre completo
  (`11-gamepad-mk2`), solo el número (`11`) o solo el slug (`gamepad-mk2`). Resuelve cualquiera de
  esos casos.
- Si no lo encuentras, muestra las specs disponibles y pide corregir el nombre.
- Si lo encuentras, continúa a la Fase 2.

---

### Fase 2 — Validar el estado de la spec

Lee la spec localizada en la Fase 1 (herramienta Read o `cat`).

Busca la línea de estado, típicamente `**Estado:**` (español) o `**Status:**` (inglés), pero puede
estar en cualquier idioma. Identifícala por posición (cerca del encabezado) y por la máquina de
estados alrededor, no por la etiqueta exacta.

**Regla absoluta:** solo continúas si el estado **significa "Approved"**, sin importar el idioma.

| Categoría de estado                           | Ejemplos (cualquier idioma)                       | Acción                                         |
| --------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Aprobado                                      | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continúa a la Fase 3.                          |
| Borrador                                      | `Draft`, `Borrador`, …                            | Detente. Muestra el mensaje de error.          |
| En revisión                                   | `In review`, `En revisión`, …                     | Detente. Muestra el mensaje de error.          |
| Implementado                                  | `Implemented`, `Implementado`, …                  | Detente. Muestra el mensaje de error.          |
| Obsoleto                                      | `Obsolete`, `Obsoleto`, …                         | Detente. Muestra el mensaje de error.          |
| Línea de estado ausente / valor no reconocido | —                                                 | Detente. El archivo no sigue el formato; dilo. |

Si dudas si un valor significa "aprobado", **no asumas**: detente y pide al usuario que lo aclare o
que actualice la spec a la redacción canónica.

**Mensaje de error estándar cuando el estado no significa Approved:**

```
❌ No puedo implementar esta spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado signifique "Approved" (p. ej. `Approved`, `Aprobado`,
o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si la spec está lista, ábrela y cambia el estado a "Approved" manualmente.
     Ese cambio lo hace el humano, no el agente.
  2. Si aún necesita trabajo, retómala con /spec [nombre].
```

No ofrezcas alternativas, no sugieras "puedo empezar de todos modos". El bloqueo es intencional.

---

### Fase 3 — Crear la rama y resumir

Confirmado el estado Approved:

1. Deriva la rama del nombre completo del archivo sin extensión, formato `spec-NN-slug`:

   - `11-gamepad-mk2.md` → rama `spec-11-gamepad-mk2`
   - `12-powerups.md` → rama `spec-12-powerups`

2. Lee el flag `AutoCreateBranch` de la **Config de creación de rama** del contexto de sesión.

   - Si el archivo no existe, el valor falta o no se reconoce → trátalo como `true` (default).
   - Solo un `false` explícito (en cualquier capitalización) desactiva la creación automática.

   **Si `AutoCreateBranch` es `true` (default):** procede sin preguntar.

   - Si la rama **no existe**: créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**: avisa al usuario (puede significar que se retoma trabajo previo).
   - En ambos casos: haz `git checkout spec-NN-slug` y confirma que el cambio fue exitoso antes de
     continuar.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de tocar git:

   ```
   AutoCreateBranch está en false.
   ¿Creo y cambio a la rama spec-NN-slug? [y/N]
   ```

   - Si responde **sí**: crea/cambia a la rama igual que en el caso `true`.
   - Si responde **no** o deja vacío: **no crees ninguna rama.** Di que implementarás en la rama
     actual y pide confirmación explícita para continuar ahí. No improvises: espera la respuesta.

3. Confirma visualmente:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)   (← o la rama actual, si no se creó ninguna)
   Estado: Approved   (← el valor real hallado en la spec)
   ```

4. **Aún no implementes.** Muestra primero el resumen de la spec: **Objetivo**, **Alcance**, **Plan
   de implementación** (los pasos numerados) y **Criterios de aceptación**. Reconoce las secciones
   por significado, no por redacción exacta — la spec puede estar en cualquier idioma.

---

### Fase 4 — Implementar paso a paso

Di al usuario:

```
Voy a implementar la spec siguiendo el plan exactamente, pausando tras cada paso para que revises el diff.

¿Empezamos con el Paso 1?
```

Espera confirmación explícita ("sí", "dale", "adelante" o equivalente). No empieces sin ella.

**Regla sobre todo:** implementa lo que dice la spec. Si algo te parece subóptimo, coméntalo como
observación pero implementa lo acordado. Los cambios a la spec van a la spec, no al código por
sorpresa.

**Ritmo de trabajo:**

- Implementa un paso del plan.
- Muestra qué archivos tocaste y qué hiciste.
- Di: `Paso N completado. Revisa el diff y dime si sigo con el Paso N+1.`
- Espera confirmación antes de continuar.

**Antes de tocar routing / params / server components**, lee la guía correspondiente en
`node_modules/next/dist/docs/` — es Next.js 16 y difiere de versiones previas.

**Si encuentras una ambigüedad** que la spec no resuelve: detente, descríbela con precisión,
presenta 2–3 opciones concretas y espera la decisión. No improvises.

**Si piden algo fuera del alcance de la spec:** recuérdalo, sugiere anotarlo para otra spec y no lo
implementes en esta rama.

**Al completar el último paso del plan**, avisa y pasa directo a la Fase 5:

```
✅ Todos los pasos del plan están implementados.
Lanzando pulido automático: skin-designer → mobile-porter.
```

---

### Fase 5 — Pulido automático (skin-designer → mobile-porter)

Esta fase es **automática y secuencial**: no pidas confirmación entre agentes.

1. **Lanza `skin-designer`** con la herramienta Agent (`subagent_type: skin-designer`,
   `run_in_background: false`). En el prompt dale contexto real:

   - Qué spec se acaba de implementar (ruta y objetivo en una línea).
   - El slug del juego afectado, si la spec toca uno.
   - La lista de archivos que tocaste en la Fase 4.
   - La instrucción: auditar el Estándar de skins e **implementar** lo que falte
     (`clasico`/`neon`/`retro` con selector persistente) hasta dejar build y lint verdes.

   **Espera su reporte completo antes de seguir.**

2. **Lanza `mobile-porter`** (`subagent_type: mobile-porter`, `run_in_background: false`) solo
   cuando skin-designer haya terminado. Pásale el mismo contexto **más** el resumen de lo que
   cambió skin-designer (archivos y hallazgos), para que audite responsive sobre el código ya
   modificado.

3. **Nunca los lances en paralelo ni en el mismo mensaje** — ambos pueden editar `app/globals.css`
   y mobile-porter debe ver el resultado de skin-designer.

4. Si un agente reporta un pendiente `requiere-spec`, **no lo implementes aquí**: repórtalo como
   pendiente para una spec nueva.

5. Cierra con un resumen combinado: hallazgos de cada agente, archivos que tocó cada uno, resultado
   de `npm run build` / `npm run lint`, y pendientes `requiere-spec`. Termina con:

   ```
   ✅ Plan implementado y pulido (skins + responsive).

   Siguiente: verifica los criterios de aceptación uno por uno.
   Si todos pasan, cambia el estado de la spec a "Implementado" y haz el commit final antes de mergear.
   ```

---

## Reglas duras

- La **Fase 5 solo corre si la Fase 4 terminó todos los pasos del plan**. Si el usuario aborta a
  media implementación, no lances ningún agente.
- Los agentes van **en secuencia, uno después del otro**, nunca simultáneos.
- **No cambies el estado de la spec automáticamente** — eso lo hace el humano.
- No hagas el commit final ni el merge por tu cuenta.

---

## Resumen del comportamiento esperado

```
/spec-impl-game 11-gamepad-mk2

  Fase 1 → Encuentra specs/11-gamepad-mk2.md
  Fase 2 → Lee el estado → "Approved" → ✅ continúa
  Fase 3 → git checkout -b spec-11-gamepad-mk2; muestra objetivo/alcance/plan/criterios
  Fase 4 → Implementa paso a paso con pausas para revisar el diff
  Fase 5 → Agent(skin-designer) → espera reporte → Agent(mobile-porter) → resumen combinado
           Termina recordando verificar criterios y marcar la spec "Implementado".

/spec-impl-game 12-powerups  (estado: Draft / Borrador)

  Fase 1 → Encuentra specs/12-powerups.md
  Fase 2 → Lee el estado → "Draft" → ❌ se detiene
           Muestra el mensaje de error estándar
           No crea rama, no toca código, no lanza agentes
```

**La creación de rama la controla el flag `AutoCreateBranch`** en `specs/.spec-config.yml`. Por
defecto es `true` (crea la rama automáticamente). Ponlo en `false` para que la Fase 3 pregunte
`[y/N]` antes de crearla.
