import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

/**
 * Cliente de Supabase para el browser (client components).
 * Usa la publishable key, expuesta al navegador por diseño; la seguridad
 * real vive en las políticas RLS del proyecto (Spec 05).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
