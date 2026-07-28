import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

/**
 * Cliente de Supabase para el servidor (Route Handlers, Server Components).
 * Lee/escribe la sesión desde las cookies de la request. En Next 16 `cookies()`
 * es async, por eso este helper es asíncrono.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // `setAll` llamado desde un Server Component: se puede ignorar si
            // hay un middleware refrescando la sesión (el patrón de esta spec).
          }
        },
      },
    },
  );
}
