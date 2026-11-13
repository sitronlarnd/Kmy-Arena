import { supabase } from "./supabase";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/** API'nin döndürdüğü i18n anahtarlı hata ("soru.zatenCevaplandi"). */
export class ApiHatasi extends Error {
  readonly durum: number;
  constructor(anahtar: string, durum: number) {
    super(anahtar);
    this.durum = durum;
  }
}

/** Oturum jetonuyla API çağrısı. Puan/XP gibi değerler yalnızca API'den gelir. */
export async function api<T>(yol: string, govde: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new ApiHatasi("giris.oturumYok", 401);
  let yanit: Response;
  try {
    yanit = await fetch(`${API}${yol}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` },
      body: JSON.stringify(govde ?? {}),
    });
  } catch {
    throw new ApiHatasi("ortak.hata", 0);
  }
  const veri = (await yanit.json().catch(() => ({}))) as T & { hata?: string };
  if (!yanit.ok) throw new ApiHatasi(veri.hata ?? "ortak.hata", yanit.status);
  return veri;
}
