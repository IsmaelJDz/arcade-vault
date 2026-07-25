# SPEC 03 — About page + envío de correo de contacto (Resend)

> **Estado:** Aprobado
> **Depende de:** `02-home-landing.md`
> **Fecha:** 2026-07-25
> **Objetivo:** Portar la pantalla About/Contacto del mockup `home-about` como nueva ruta `/about`, agregar el link "Acerca de" al Nav, y conectar el formulario de contacto a un envío de correo real vía Resend.

---

## Alcance

**Dentro:**

- **Ruta `/about` (`app/about/page.tsx`, nueva)** — client component: hero About (kicker, título, misión, `highlight-row` con 3 highlights: HEART/BROWSER/PLANT + iconos SVG), banner divisor decorativo, sección de contacto (intro con tips + formulario). Reveal-on-scroll vía el mismo patrón `useReveal`/`IntersectionObserver` ya usado en Home (spec 02).
- **Formulario de contacto** — campos NOMBRE, CORREO ELECTRÓNICO, MENSAJE + campo honeypot oculto (anti-spam simple). Validación client-side: no vacíos (igual que el mockup) + formato de email básico (regex). Estados: idle → **enviando** (botón deshabilitado, texto "ENVIANDO…") → **éxito** (bloque `terminal-success`, igual que el mockup, con botón "ENVIAR OTRO MENSAJE") o **error** (bloque de error inline, conserva los datos del formulario para reintentar).
- **`app/api/contact/route.ts` (nuevo, Route Handler POST)** — recibe `{ name, email, msg, honeypot }`, valida en servidor (defensa adicional a la validación client-side), descarta silenciosamente si el honeypot viene lleno (responde éxito sin llamar a Resend), y envía el correo vía SDK de Resend. La API key nunca llega al cliente.
- **Integración Resend** — se agrega la dependencia `resend` a `package.json`. Remitente: `onboarding@resend.dev` (dominio de pruebas). Destino: `ismaelbr87@gmail.com`. Ambos configurables por variables de entorno, no hardcodeados.
- **Variables de entorno** — `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` en `.env.local` (ya ignorado por `.env*` en `.gitignore`, no se versiona). Se agrega `.env.example` (sí versionado) documentando los nombres de las 3 variables sin valores reales, como referencia para quien clone el repo.
- **`app/nav.tsx`** — nuevo link "Acerca de" → `/about` (activo en `/about`), agregado al nav desktop y al panel móvil. Spec 02 lo había dejado explícitamente fuera; esta spec lo incorpora.
- **CSS** — portar a `app/globals.css` el bloque `ABOUT PAGE` de `references/resources/templates/home-about/styles.css` (~líneas 1071–1130+), solo las clases que usa About.

**Fuera de alcance (para specs futuras):**

- Persistencia del mensaje de contacto (DB, archivo, log) — solo se envía por correo y se descarta; no se guarda en la app.
- Protecciones anti-spam avanzadas — rate limiting, captcha, verificación de dominio del remitente. Solo el honeypot simple.
- Correo de confirmación/autoresponder al usuario que llena el formulario — igual que el mockup, solo se notifica al destino fijo, no se envía copia al remitente.
- Dominio propio verificado en Resend para producción — queda con el dominio de pruebas `onboarding@resend.dev`; migrar a dominio propio es una decisión operativa futura, no de código.
- Rediseño del CSS ya portado.
- Tests automatizados (no hay runner configurado en el proyecto).

---

## Modelo de datos

Esta feature **no introduce datos persistidos** (ni DB, ni localStorage, ni archivos) — el mensaje se envía por correo y se descarta. Sí introduce el contrato del Route Handler y las variables de entorno:

```ts
// Payload enviado por el form (POST /api/contact)
interface ContactPayload {
  name: string;
  email: string;
  msg: string;
  honeypot: string; // debe llegar vacío; si no, se descarta silenciosamente
}

// Respuesta del Route Handler
type ContactResponse = { ok: true } | { ok: false; error: string };
```

```bash
# .env.local (gitignored) — .env.example documenta estos nombres sin valores
RESEND_API_KEY=       # API key de Resend
CONTACT_TO_EMAIL=     # ismaelbr87@gmail.com — destino de los mensajes
CONTACT_FROM_EMAIL=   # onboarding@resend.dev — remitente (dominio de pruebas)
```

Convenciones:

- Validación de `email` (regex básico) y "no vacío" ocurre **tanto en cliente** (feedback inmediato, shake) **como en servidor** (defensa adicional, ya que el Route Handler es un endpoint público).
- El honeypot es un campo de formulario oculto vía CSS (no `type="hidden"`, para que bots que sí ejecutan CSS también caigan) que un usuario real nunca llena.

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable.

1. **Dependencia + env vars** — agregar `resend` a `package.json` (`npm install resend`); crear `.env.example` (versionado) documentando `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` sin valores; el usuario llena `.env.local` (gitignored) con los valores reales. Prueba: `npm install` y `npm run build` compilan sin cambios funcionales todavía.

2. **CSS del About** — portar a `app/globals.css` el bloque `ABOUT PAGE` de `references/resources/templates/home-about/styles.css` (~líneas 1071–1130+). Prueba: `npm run build` compila; clases disponibles para los pasos siguientes.

3. **`app/api/contact/route.ts`** — Route Handler `POST`: valida `ContactPayload` server-side (no vacíos + regex de email), descarta silenciosamente si `honeypot` viene lleno (`{ok:true}` sin llamar a Resend), envía el correo con el SDK de Resend usando `CONTACT_FROM_EMAIL` → `CONTACT_TO_EMAIL`, captura errores de Resend y responde `{ok:false, error}`. Prueba: probar con `curl`/Postman payload válido (llega el correo real a `ismaelbr87@gmail.com`), payload inválido (`ok:false`) y honeypot lleno (`ok:true` sin correo).

4. **`app/about/page.tsx` — Hero + highlights** — kicker, título, párrafo de misión, `highlight-row` con los 3 highlights (HEART/BROWSER/PLANT) e iconos SVG, banner divisor. Sin formulario todavía. Prueba: `/about` renderiza hero completo.

5. **`app/about/page.tsx` — Formulario de contacto** — campos NOMBRE/CORREO/MENSAJE + honeypot oculto vía CSS, validación client-side (no vacíos + regex email, shake en error), estados idle/enviando (botón deshabilitado "ENVIANDO…")/éxito (`terminal-success`, "ENVIAR OTRO MENSAJE")/error (bloque inline, conserva los datos), `fetch("/api/contact")`. Prueba: envío válido muestra éxito y el correo llega; campo vacío o email mal formado dispara shake; forzar un error del endpoint muestra el bloque de error sin perder lo escrito.

6. **Reveal-on-scroll** — aplicar el mismo hook `useReveal` (`IntersectionObserver`) de Home a las secciones `.reveal` de About (divider, contacto). Prueba: las secciones aparecen con fade/translate al hacer scroll.

7. **`app/nav.tsx`** — agregar link "Acerca de" → `/about`, activo en `/about`, en el nav desktop y en el panel móvil. Prueba: el nav resalta "Acerca de" solo en `/about`; navega correctamente en ambos layouts.

8. **Limpieza** — verificar que ninguna clase CSS usada por About falte en `globals.css`; `npm run build` + `npm run lint` sin errores. Prueba: recorrido completo Home → About (vía Nav) → llenar y enviar el formulario → confirmar el correo real recibido en `ismaelbr87@gmail.com` → "ENVIAR OTRO MENSAJE".

Notas de conversión (igual que specs 01/02): `app/about/page.tsx` lleva `"use client"` (estado del form + observer); el Route Handler es server-only, la API key de Resend solo se lee ahí (`process.env.RESEND_API_KEY`), nunca se expone al cliente.

---

## Criterios de aceptación

**Ruteo y Nav**

- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] `npm run lint` pasa sin errores.
- [ ] `/about` renderiza la pantalla About.
- [ ] El link "Acerca de" del Nav navega a `/about` y se resalta como activo solo en esa ruta.
- [ ] El comportamiento del link se replica en el panel móvil.

**About (hero + highlights)**

- [ ] El hero muestra kicker, título, párrafo de misión y los 3 highlights (HEART/BROWSER/PLANT) con sus iconos.
- [ ] El banner divisor decorativo se muestra entre el hero y la sección de contacto.
- [ ] Las secciones con clase `.reveal` aparecen (fade/translate) al hacer scroll hasta ellas.

**Formulario de contacto**

- [ ] Enviar con algún campo vacío dispara el efecto shake y no llama al endpoint.
- [ ] Enviar con un email mal formado dispara el efecto shake y no llama al endpoint.
- [ ] Enviar el formulario completo y válido muestra el estado "ENVIANDO…" con el botón deshabilitado mientras espera respuesta.
- [ ] Un envío exitoso llega realmente por correo a `ismaelbr87@gmail.com` vía Resend.
- [ ] Un envío exitoso muestra el bloque `terminal-success` con el nombre del remitente.
- [ ] "ENVIAR OTRO MENSAJE" limpia el formulario y vuelve al estado idle.
- [ ] Si el endpoint responde error (o falla la red), se muestra un bloque de error inline y los datos escritos por el usuario no se pierden.
- [ ] Llenar el campo honeypot (simulado, ej. vía devtools) hace que el endpoint responda éxito sin enviar el correo real.

**Configuración**

- [ ] `.env.example` existe y documenta `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` sin valores reales.
- [ ] `.env.local` con valores reales no aparece en `git status` (ya cubierto por `.env*` en `.gitignore`).

---

## Decisiones

- **Sí:** Ruta `/about` (inglés). Consistente con las rutas ya existentes (`/game`, `/play`, `/hall`, `/login`); la UI visible sigue en español.
- **No:** `/acerca-de`. Rompería el patrón de rutas en inglés del resto del sitio.
- **Sí:** Agregar el link "Acerca de" al Nav en esta spec (desktop + móvil). Spec 02 lo dejó pendiente justamente porque la ruta no existía; ahora que existe, no tiene sentido dejar About solo accesible por URL directa.
- **No:** Dejar el link fuera. Sería una pantalla "fantasma" sin descubribilidad real.
- **Sí:** Envío de correo vía Route Handler (`app/api/contact/route.ts`), no Server Action. La API key de Resend queda estrictamente server-side y el endpoint es explícito/testeable con `curl` independientemente del formulario.
- **No:** Server Action. Menos explícito para probar el envío de forma aislada durante el desarrollo.
- **Sí:** Remitente `onboarding@resend.dev` (dominio de pruebas de Resend), destino fijo `ismaelbr87@gmail.com`, ambos vía variables de entorno. No hay dominio propio verificado en Resend todavía.
- **No:** Dominio propio verificado. Requeriría configuración DNS fuera del alcance de esta spec; se puede migrar después cambiando solo la env var `CONTACT_FROM_EMAIL`.
- **Sí:** Validación de formato de email (regex básico) además de "no vacío", tanto en cliente como en servidor. El mockup solo validaba "no vacío" porque nunca enviaba nada de verdad; con Resend real un email mal formado desperdicia la llamada a la API.
- **No:** Mantener solo la validación del mockup. Insuficiente ahora que hay un envío real de por medio.
- **Sí:** Estado "ENVIANDO…" con botón deshabilitado durante la llamada al Route Handler. Necesario para evitar doble envío y dar feedback de una operación de red real (el mockup no lo necesitaba porque el "envío" era instantáneo y falso).
- **Sí:** Mensaje de error inline si el envío falla, conservando los datos del formulario. El mockup no contemplaba fallos porque no había backend real; ahora sí puede fallar (red, Resend caído, rate limit) y perder lo escrito sería mala UX.
- **No:** Reusar el shake genérico para errores de servidor. El shake ya significa "campo inválido"; un error de envío es una causa distinta y merece su propio mensaje.
- **Sí:** No persistir el mensaje de contacto en ningún lado (DB, log, archivo) — solo se envía por correo y se descarta. Consistente con que el proyecto no tiene backend/DB propios todavía (specs 01/02 usan solo `localStorage` para sesión).
- **No:** Guardar copia del mensaje. Abriría alcance (dónde, con qué modelo, con qué retención) sin un requerimiento claro para esta spec.
- **Sí:** Honeypot simple como única protección anti-spam (campo oculto vía CSS; si llega lleno, el Route Handler responde éxito sin llamar a Resend). Filtra bots simples sin dependencias ni servicios nuevos.
- **No:** Rate limiting, captcha o verificación de dominio del remitente. Sobre-ingeniería para el volumen esperado de un formulario de contacto de un proyecto en construcción; se puede añadir después si se vuelve un problema real.
- **Sí:** `.env.example` versionado con los nombres de las 3 variables sin valores; `.env.local` real queda gitignored (ya cubierto por `.env*`) y el usuario lo configura antes de `/spec-impl` o de probar el envío real.
- **No:** Hardcodear la API key o las direcciones de correo en el código. Filtración de secretos y acopla el código a un solo entorno.
- **Sí:** Reusar `app/globals.css` tal cual, solo añadiendo el bloque `ABOUT PAGE` del mockup. Mismo patrón que specs 01 y 02.
- **No:** Rediseñar o refactorizar CSS existente. Fuera de alcance.

---

## Riesgos

| Riesgo                                                                                                                                                                                                                                            | Mitigación                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El dominio de pruebas `onboarding@resend.dev` de Resend solo entrega correos a la dirección verificada de la cuenta Resend — si `CONTACT_TO_EMAIL` no coincide con esa cuenta, los envíos pueden fallar o no llegar aunque la API responda éxito. | Verificar en el paso 3 (prueba manual con `curl`) que el correo realmente llega a `ismaelbr87@gmail.com`; si no coincide con la cuenta Resend usada, dejarlo documentado como bloqueante antes de cerrar la spec. |
| `RESEND_API_KEY` termina usada accidentalmente en un client component en vez de en el Route Handler, exponiéndola en el bundle del navegador.                                                                                                     | La key solo se lee con `process.env.RESEND_API_KEY` dentro de `app/api/contact/route.ts` (archivo server-only); el form (`app/about/page.tsx`) solo hace `fetch("/api/contact")`, nunca importa el SDK de Resend. |
| El hook `useReveal` (`IntersectionObserver`) corre en el cuerpo del render en vez de en `useEffect`, causando mismatch de hidratación SSR.                                                                                                        | Igual que en specs 01/02: el observer solo se monta dentro de `useEffect`, nunca durante el render.                                                                                                               |
| Falte alguna clase CSS del bloque `ABOUT PAGE` del mockup que la pantalla da por hecha (highlights, contact-form, terminal-success, etc.) y no se portó a `globals.css`.                                                                          | El paso 8 (limpieza) compara clases usadas en el JSX de About contra `globals.css` y añade solo las ausentes.                                                                                                     |
| `.env.local` no configurado (falta `RESEND_API_KEY`) hace que el Route Handler falle en cada intento de envío real, sin que sea evidente por qué.                                                                                                 | El Route Handler valida que las 3 env vars existan al inicio de la request y responde `{ok:false, error:"..."}` con un mensaje claro si falta alguna, en vez de un error genérico o un crash.                     |
| El campo honeypot, si se oculta con `display:none`, puede ser ignorado por algunos bots (que sí leen CSS) o, al revés, con una técnica de ocultamiento pobre, quedar visible/enfocable para usuarios reales con lectores de pantalla.             | Ocultar con una técnica estándar accesible (posición fuera de pantalla + `tabIndex={-1}` + `aria-hidden`), no solo `display:none`, y sin marcarlo `required`.                                                     |

---

## Lo que **no** entra en esta spec

- Persistencia del mensaje de contacto (DB, archivo, log).
- Protecciones anti-spam avanzadas (rate limiting, captcha, verificación de dominio).
- Correo de confirmación/autoresponder al remitente.
- Dominio propio verificado en Resend para producción.
- Rediseño del CSS ya portado.
- Tests automatizados.

Cada uno de estos, si llega, va en su propia spec.
