# SPEC 04 — Autenticación real con Supabase (email/password)

> **Estado:** Aprobado
> **Depende de:** `01-visual-screens-app-router.md` (sesión + `/login` + Nav)
> **Fecha:** 2026-07-27
> **Objetivo:** Reemplazar la sesión falsa de `localStorage` por Supabase Auth con email/password (registro con confirmación de correo, inicio de sesión, cierre de sesión y SSR vía cookies), conservando el "jugar como invitado" y dejando `saveScore` intacto para la Spec 05.

Notas de contexto:

- **Proyecto Supabase existente**: `eqsknyiewfyggpatpfcs`, ya configurado en `.mcp.json`. Se opera vía MCP.
- **Solo email/password** (decisión cerrada): sin OAuth ni magic link ni anonymous auth. Los botones sociales de `/login` siguen decorativos.
- **Invitado**: sigue siendo estado local efímero (sin sesión Supabase, `user = null`), igual que hoy. No guarda puntuaciones.
- **`saveScore` no se toca** en esta spec: sigue en `localStorage` (`av_scores`) hasta la Spec 05.
- **Scores en DB, realtime y edge functions**: fuera de alcance (Spec 05 y posteriores).

---

## Alcance

**Dentro:**

- **Dependencias** — agregar `@supabase/supabase-js` y `@supabase/ssr` a `package.json`.
- **Variables de entorno** — `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key) en `.env.local`; documentadas en `.env.example` sin valores. Se leen vía MCP (`get_project_url`, `get_publishable_keys`). No se necesita service-role key en esta spec.
- **Clientes Supabase**:
  - `lib/supabase/client.ts` — cliente de **browser** (`createBrowserClient`).
  - `lib/supabase/server.ts` — cliente de **servidor** (`createServerClient`) con lectura/escritura de cookies (Route Handlers, middleware).
- **`middleware.ts`** — refresco de token en cada request (patrón oficial `@supabase/ssr` para App Router), escribiendo cookies actualizadas.
- **`app/auth/callback/route.ts`** — Route Handler `GET` que verifica el `token_hash`/`code` del link de confirmación de correo, establece la sesión (cookies) y redirige a `/`.
- **`app/session-provider.tsx` (modificado)** — deriva `user` de la sesión de Supabase (`onAuthStateChange` + sesión inicial), expone `signUp()`, `signIn()`, `signOut()` reales. `user.name` = `user_metadata.display_name`. Añade `loading` para el estado inicial. **`saveScore` se conserva tal cual** (localStorage). Deja de usar `av_user`.
- **`app/login/page.tsx` (modificado)** — pestañas iniciar/crear conectadas a `signIn`/`signUp` reales (email + password + nombre en registro). Estados: enviando, error inline (credenciales/registro), y en registro exitoso el aviso "revisa tu correo". "Jugar como invitado" → `router.push("/")` sin sesión. Botones sociales siguen decorativos.
- **`app/nav.tsx` (ajuste mínimo)** — el botón de sesión usa el nuevo `signOut` async; muestra `display_name`. Solo se adapta a la nueva API del provider.
- **Configuración del proyecto Supabase (vía MCP)** — habilitar email/password, mantener confirmación de correo activada, registrar la Redirect URL (`/auth/callback`) y ajustar la plantilla del correo de confirmación para que apunte a esa ruta.

**Fuera de alcance (specs futuras):**

- **Puntuaciones en DB, leaderboards reales, migración de `av_scores`, RLS de scores** → Spec 05. `saveScore` y `seededScores` no se tocan aquí.
- **OAuth (Google/GitHub), magic link, anonymous auth** → los sociales siguen decorativos; invitado sigue siendo estado local.
- **Tabla `profiles`** → el nombre vive en `user_metadata`; no se crea estructura de DB en esta spec.
- **Recuperación de contraseña / reset / cambio de email** → spec futura si se necesita.
- **Realtime, edge functions** → posteriores.
- **Tests** (no hay runner) y rediseño de CSS.

---

## Modelo de datos

Esta spec **no crea tablas** en Postgres — la identidad la administra Supabase Auth (`auth.users`, gestionado). Solo se define el shape del contexto de sesión y las variables de entorno.

**Identidad (Supabase Auth, gestionado):**

```
auth.users
  id            uuid       (auth.uid())
  email         text
  user_metadata { display_name: string }   // capturado en el registro
```

- `display_name`: nombre visible, `toUpperCase().slice(0, 10)` (misma convención del mockup). Se pasa en `signUp` vía `options.data.display_name`.

**Sesión (`app/session-provider.tsx`) — nueva API:**

```ts
interface User {
  name: string; // = user_metadata.display_name
  email: string;
}

type AuthResult = { ok: true } | { ok: false; error: string };

interface SessionContext {
  user: User | null; // null = invitado / sin sesión
  loading: boolean; // true mientras se resuelve la sesión inicial
  signUp: (email: string, password: string, name: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  saveScore: (e: Omit<ScoreEntry, "at">) => void; // SIN CAMBIOS — localStorage av_scores
}
```

```bash
# .env.local (gitignored) — .env.example documenta estos nombres sin valores
NEXT_PUBLIC_SUPABASE_URL=          # get_project_url (MCP)
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=     # publishable key — get_publishable_keys (MCP)
```

Convenciones:

- `user` se **deriva** de la sesión de Supabase, nunca de `localStorage`. `signOut` limpia la sesión (cookies); el `onAuthStateChange` pone `user = null`.
- Invitado = sin sesión (`user === null`); no se persiste ningún `av_user`.
- `av_scores` sigue existiendo intacto (lo consume `saveScore`/reproductor); se migrará en Spec 05.
- La clave publishable (`NEXT_PUBLIC_*`) es de exposición pública por diseño; la seguridad real vendrá de RLS en Spec 05. No se usa service-role key aquí.

---

## Plan de implementación

Cada paso deja el sistema compilando y navegable. Antes de escribir código de framework, leer el guía correspondiente en `node_modules/next/dist/docs/` (App Router, middleware) — esta es Next.js 16, con cambios respecto a versiones anteriores.

1. **Dependencias + env vars** — `npm install @supabase/supabase-js @supabase/ssr`. Obtener URL y publishable key vía MCP (`get_project_url`, `get_publishable_keys`), ponerlos en `.env.local` y documentar los nombres en `.env.example`. Prueba: `npm install` y `npm run build` compilan; sin cambios funcionales todavía.

2. **Clientes Supabase** — `lib/supabase/client.ts` (`createBrowserClient`) y `lib/supabase/server.ts` (`createServerClient` con adaptador de cookies de Next 16). Prueba: importarlos desde un archivo temporal compila y resuelve tipos.

3. **`middleware.ts`** — patrón `@supabase/ssr`: refresca la sesión en cada request y reescribe cookies. `matcher` que excluya assets estáticos. Prueba: navegar por las rutas existentes sigue funcionando; las cookies de Supabase se refrescan (visible en devtools).

4. **Configurar el proyecto Supabase (MCP)** — habilitar provider email/password, mantener confirmación de correo, registrar Redirect URL `http://localhost:3000/auth/callback` (+ la de producción cuando exista) y ajustar la plantilla del correo de confirmación para apuntar a `/auth/callback` con `token_hash` + `type`. Prueba: en el dashboard/MCP el provider aparece habilitado con confirmación activa.

5. **`app/auth/callback/route.ts`** — `GET` que lee `token_hash` + `type` (o `code`), verifica con el cliente de servidor (`verifyOtp`/`exchangeCodeForSession`), establece cookies y redirige a `/` (o a un `next` param); en error redirige a `/login` con mensaje. Prueba: abrir el link del correo de confirmación establece la sesión y aterriza logueado en `/`.

6. **`app/session-provider.tsx`** — reescribir sobre el cliente de browser: sesión inicial + `onAuthStateChange` → deriva `user = { name: display_name, email }`; `loading` mientras resuelve. Implementar `signUp` (con `options.data.display_name` y `emailRedirectTo` a `/auth/callback`), `signIn`, `signOut`. **No tocar `saveScore`**. Quitar lecturas de `av_user`. Prueba: montar no rompe; `signIn` con credenciales válidas actualiza `user`; `signOut` lo pone en `null`.

7. **`app/login/page.tsx`** — conectar las pestañas: crear → `signUp` (email, password, nombre) → estado "revisa tu correo"; iniciar → `signIn` → `router.push("/")`; error inline sin perder lo escrito; botón deshabilitado "ENVIANDO…". "Jugar como invitado" → `router.push("/")`. Sociales decorativos. Prueba: registro muestra aviso y llega el correo; login válido entra y redirige; credenciales malas muestran error.

8. **`app/nav.tsx`** — adaptar el botón de sesión a la nueva API (`user.name`, `signOut` async). Mientras `loading`, no parpadear entre estados. Prueba: logueado muestra el nombre y cierra sesión al hacer clic; sin sesión muestra "Iniciar Sesión".

9. **Limpieza** — `npm run build` + `npm run lint` sin errores. Recorrido completo: registrar → confirmar por correo → quedar logueado → recargar (sesión persiste vía cookies) → cerrar sesión → entrar de nuevo → jugar como invitado (sin sesión). Prueba: todo el flujo pasa; `av_user` ya no se usa; `av_scores`/reproductor siguen funcionando igual.

Notas de conversión:

- El provider y `/login` son client components (`"use client"`); los clientes de servidor y el callback son server-only.
- La publishable key va en `NEXT_PUBLIC_*` (pública por diseño); no se introduce service-role key.
- Nunca leer `localStorage` para la identidad: la sesión vive en cookies gestionadas por `@supabase/ssr`.

---

## Criterios de aceptación

**Build y configuración**

- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] `npm run lint` pasa sin errores.
- [ ] `.env.example` documenta `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores reales.
- [ ] `.env.local` con valores reales no aparece en `git status` (cubierto por `.env*`).
- [ ] En el proyecto Supabase, el provider email/password está habilitado con confirmación de correo activa y la Redirect URL `/auth/callback` registrada.

**Registro (crear cuenta)**

- [ ] Enviar el formulario de registro con email + password + nombre crea el usuario en Supabase Auth.
- [ ] El `display_name` queda guardado en `user_metadata` (mayúsculas, máx 10 chars).
- [ ] Tras registrar, la UI muestra el estado "revisa tu correo" (no entra directo).
- [ ] Llega un correo de confirmación real a la dirección registrada.
- [ ] Abrir el link del correo aterriza en `/` con la sesión iniciada.

**Inicio de sesión**

- [ ] Iniciar sesión con credenciales válidas redirige a `/` y el Nav muestra el `display_name`.
- [ ] Credenciales inválidas muestran un mensaje de error inline sin perder lo escrito.
- [ ] Intentar entrar con una cuenta sin confirmar muestra un error claro (no una sesión a medias).
- [ ] Mientras espera la respuesta, el botón se deshabilita con "ENVIANDO…".

**Sesión / SSR**

- [ ] La sesión sobrevive a una recarga de página (cookies vía `@supabase/ssr`), sin usar `av_user`.
- [ ] El middleware refresca el token sin romper la navegación por las rutas existentes.
- [ ] Clic en el nombre del usuario en el Nav cierra la sesión y vuelve a "Iniciar Sesión".

**Invitado y no-regresión**

- [ ] "Jugar como invitado" navega a `/` sin crear sesión (`user === null`).
- [ ] Los botones sociales de `/login` siguen siendo decorativos (no hacen nada).
- [ ] `saveScore` y el reproductor siguen guardando en `av_scores` como antes (sin cambios).
- [ ] Los leaderboards siguen mostrando `seededScores` (sin cambios en esta spec).

---

## Decisiones

- **Sí:** Solo email/password. Único método pedido; sin OAuth/magic link/anonymous. Los sociales de `/login` siguen decorativos.
  - **No:** OAuth o anonymous auth ahora. Fuera de lo pedido; anonymous se descartó explícitamente (el invitado no guarda puntuaciones).
- **Sí:** Mantener la confirmación de correo activa (registro → "revisa tu correo" → link → sesión). Flujo realista y estándar de Supabase.
  - **No:** Desactivar la confirmación. Más cómodo para dev, pero se optó por el flujo real desde el inicio para no re-tocarlo después.
- **Sí:** `display_name` en `user_metadata`. Cero estructura de DB en la spec de auth; suficiente para el Nav y para que Spec 05 tenga un nombre estable.
  - **No:** Tabla `profiles` con trigger. Es modelo de datos que encaja mejor cuando existan scores (Spec 05); meterlo aquí sería alcance prestado.
- **Sí:** `@supabase/ssr` con cookies + `middleware.ts` (browser client + server client separados). Patrón oficial para App Router; la sesión persiste y es legible en servidor.
  - **No:** Solo cliente de browser sin SSR. Más simple, pero la sesión no estaría disponible en Route Handlers/Server Components, bloqueando la Spec 05.
- **Sí:** Invitado = sin sesión de Supabase (`user === null`), estado efímero. Idéntico al comportamiento actual; no ensucia la identidad real.
  - **No:** Invitado con anonymous sign-in. Le daría `auth.uid()`, pero se cerró que el invitado no guarda puntuaciones, así que no aporta.
- **Sí:** No tocar `saveScore`; sigue en `localStorage` hasta Spec 05. Minimiza el diff y desacopla auth de scores.
  - **No:** Migrar scores en esta spec. Es el núcleo de la Spec 05 (con RLS, migración al primer login, leaderboards reales).
- **Sí:** Reemplazar `login/signOut` del provider por `signUp/signIn/signOut` reales y dejar de leer `av_user`. La identidad la administra Supabase.
  - **No:** Conservar `login(null)` para invitado. Innecesario: invitado = navegar a `/` sin sesión.
- **Sí:** Publishable key en `NEXT_PUBLIC_*`, sin service-role key en la app. La seguridad real llega con RLS en Spec 05; la publishable es pública por diseño.
  - **No:** Introducir service-role key ahora. No hace falta para auth por cookies y sería un secreto de más que resguardar.
- **Sí:** Ruta `/auth/callback` (inglés). Consistente con el resto de rutas del sitio.
  - **No:** `/auth/callback` con otro nombre localizado. Rompería el patrón de rutas en inglés.

---

## Riesgos

| Riesgo                                                                                                                                                                                     | Mitigación                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El correo de confirmación por defecto de Supabase apunta a su endpoint `verify`, no a `/auth/callback`; sin ajustar la plantilla + Redirect URL, el link no establece la sesión en la app. | Paso 4 configura Redirect URL y plantilla (`token_hash` + `type` → `/auth/callback`); el paso 5 verifica end-to-end abriendo un link real.                           |
| Adaptador de cookies mal implementado en `middleware.ts`/`server.ts` (API de cookies de Next 16 difiere de versiones previas) → la sesión no se refresca o se pierde al recargar.          | Leer la guía de middleware en `node_modules/next/dist/docs/` y seguir el patrón `@supabase/ssr` al pie; criterio de aceptación "sesión sobrevive recarga" lo valida. |
| La publishable/anon key se confunde con la service-role key y se expone una clave privilegiada en el bundle.                                                                               | Solo se usa la publishable key en `NEXT_PUBLIC_*`; no se introduce service-role en esta spec (decisión explícita).                                                   |
| Cuenta sin confirmar intenta iniciar sesión y queda en un estado ambiguo (ni entra ni mensaje claro).                                                                                      | Criterio de aceptación específico: error claro para cuenta no confirmada; el `signIn` mapea ese caso a un mensaje inline.                                            |
| Mismatch de hidratación: el Nav renderiza estado logueado/deslogueado distinto en SSR vs cliente mientras resuelve la sesión.                                                              | `loading` en el provider; el Nav no parpadea entre estados hasta resolver la sesión inicial.                                                                         |
| El link de confirmación caduca o se reusa (`token_hash` de un solo uso) → el callback falla silenciosamente.                                                                               | El callback maneja el error y redirige a `/login` con mensaje; no asume éxito.                                                                                       |

---

## Lo que **no** entra en esta spec

- Puntuaciones en DB, leaderboards reales, migración de `av_scores`, RLS de scores (Spec 05).
- OAuth, magic link, anonymous auth (sociales siguen decorativos).
- Tabla `profiles` / estructura de DB (el nombre vive en `user_metadata`).
- Recuperación / reset de contraseña, cambio de email.
- Realtime, edge functions.
- Tests automatizados y rediseño de CSS.

Cada uno de estos, si llega, va en su propia spec.
