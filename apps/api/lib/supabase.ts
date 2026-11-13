import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ortam } from "./ortam";

let servis: SupabaseClient | null = null;

/**
 * Service role istemcisi: RLS'i atlar. YALNIZCA sunucuda, yetki kontrolü
 * yapıldıktan sonra ve denetim kaydı yazılarak kullanılır.
 */
export function servisIstemcisi(): SupabaseClient {
  if (servis) return servis;
  const e = ortam();
  servis = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return servis;
}

/**
 * İsteği yapan kullanıcının JWT'siyle çalışan istemci: RLS geçerlidir.
 * Mobil/web istemci Authorization: Bearer <access_token> gönderir.
 */
export function kullaniciIstemcisi(istek: Request): SupabaseClient | null {
  const baslik = istek.headers.get("authorization");
  if (!baslik?.startsWith("Bearer ")) return null;
  const e = ortam();
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!anon) throw new Error("SUPABASE_ANON_KEY tanımlı değil");
  return createClient(e.SUPABASE_URL, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { authorization: baslik } },
  });
}
