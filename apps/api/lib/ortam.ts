import "server-only";
import { z } from "zod";

/**
 * Sunucu ortam değişkenleri — yalnızca sunucuda okunur ve doğrulanır.
 * KMYAI_API_KEY ve SUPABASE_SERVICE_ROLE_KEY asla istemciye gitmez.
 */
const Sema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  KMYAI_BASE_URL: z.url().default("https://www.kmyai.cloud/api/v1"),
  KMYAI_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().optional(),
  SAHIP_EPOSTA: z.email().optional(),
});

export type SunucuOrtami = z.infer<typeof Sema>;

let onbellek: SunucuOrtami | null = null;

export function ortam(): SunucuOrtami {
  if (onbellek) return onbellek;
  const sonuc = Sema.safeParse(process.env);
  if (!sonuc.success) {
    const eksik = sonuc.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Ortam değişkenleri eksik veya hatalı: ${eksik}`);
  }
  onbellek = sonuc.data;
  return onbellek;
}

/** Ortam değişkenlerinin ham hâli (model adları vb. için). */
export function hamOrtam(): Readonly<Record<string, string | undefined>> {
  return process.env;
}
