import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let istemci: SupabaseClient | null = null;

/**
 * Service role istemcisi — YALNIZCA sunucuda, merkez yetkisi doğrulandıktan
 * sonra ve denetim kaydı yazılarak kullanılır (RLS'te merkeze istisna yok).
 */
export function servis(): SupabaseClient {
  if (istemci) return istemci;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anahtar = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anahtar) throw new Error("SUPABASE_SERVICE_ROLE_KEY tanımlı değil");
  istemci = createClient(url, anahtar, { auth: { persistSession: false, autoRefreshToken: false } });
  return istemci;
}

export async function denetle(kullaniciId: string, islem: string, hedef: string, ayrinti: Record<string, unknown> = {}): Promise<void> {
  await servis().from("denetim_log").insert({ kullanici_id: kullaniciId, islem, hedef, ayrinti });
}
