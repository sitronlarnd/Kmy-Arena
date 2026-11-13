import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Tarayıcı istemcisi (yalnızca anon anahtar; koruma RLS'te). */
export function tarayiciIstemcisi(): SupabaseClient {
  return createBrowserClient(URL, ANON);
}

/** Sunucu bileşenleri ve route handler'lar için oturum çerezli istemci. */
export async function sunucuIstemcisi(): Promise<SupabaseClient> {
  const { cookies } = await import("next/headers");
  const cerezler = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll: () => cerezler.getAll(),
      setAll: (liste) => {
        try {
          for (const { name, value, options } of liste) cerezler.set(name, value, options);
        } catch {
          // Sunucu bileşeninden çağrıldıysa çerez yazılamaz; proxy oturumu yeniler.
        }
      },
    },
  });
}
