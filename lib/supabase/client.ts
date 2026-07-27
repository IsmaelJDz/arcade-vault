import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente de Supabase para el browser (client components).
 * Usa la publishable key, expuesta al navegador por diseño; la seguridad
 * real vive en las políticas RLS del proyecto (Spec 05).
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
