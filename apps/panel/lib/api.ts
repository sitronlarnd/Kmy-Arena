import "server-only";
import { sunucuIstemcisi } from "./supabase";

/** API projesine oturumdaki kullanıcının jetonuyla istek (AI işlemleri API'dedir). */
export async function apiCagir<T>(yol: string, govde: unknown): Promise<T> {
  const s = await sunucuIstemcisi();
  const { data } = await s.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error("panel.yetkisiz");
  const taban = process.env.NEXT_PUBLIC_API_URL ?? "https://api-bice-phi-66.vercel.app";
  const r = await fetch(`${taban}${yol}`, {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${jeton}` }, body: JSON.stringify(govde), cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as T & { hata?: string };
  if (!r.ok) throw new Error(j.hata ?? `api ${r.status}`);
  return j;
}

export interface KazanimSecenek { id: string; kod: string; aciklama: string; ders: string; dersId: string; sinav: string }
