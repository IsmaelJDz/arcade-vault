import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (antes "middleware"; renombrado en Next.js 16, misma funcionalidad).
 * Refresca la sesión de Supabase en cada request y reescribe las cookies
 * actualizadas, siguiendo el patrón oficial de `@supabase/ssr` para App Router.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresca el token si expiró. NO metas lógica entre createServerClient y
  // getUser(): el patrón de @supabase/ssr depende de este orden.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas menos:
     * - _next/static, _next/image (assets del build)
     * - favicon.ico y archivos de imagen
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
