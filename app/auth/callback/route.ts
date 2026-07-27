import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Confirmación de correo (Supabase Auth, flujo server-side con token_hash).
 * La plantilla "Confirm signup" apunta a:
 *   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email
 * Verificamos el token, se escriben las cookies de sesión y redirigimos.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  // Token ausente, inválido o caducado → de vuelta al login con aviso.
  return NextResponse.redirect(new URL("/login?error=confirmacion", origin));
}
