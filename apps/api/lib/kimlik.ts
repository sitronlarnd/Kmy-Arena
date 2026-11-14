import "server-only";
import { IstemciHatasi } from "./http";
import { servisIstemcisi } from "./supabase";

export interface Kullanici {
  id: string;
  dershaneId: string;
  tur: "ogrenci" | "veli" | "personel" | "merkez";
  /** AI isteklerinde geçmemesi gereken kişisel değerler (KVKK) */
  yasakliDegerler: string[];
  /** Sosyal özellikler (topluluk, klan sohbeti) açık mı? 18 yaş altında veli onayı gerekir. */
  sosyalAcik: boolean;
}

/** Doğum yılı bilinmiyorsa reşit değil sayılır (temkinli varsayılan). */
export function sosyalAcikMi(dogumYili: number | null, veliOnayi: boolean, tur: string, simdi = new Date()): boolean {
  if (tur !== "ogrenci" || veliOnayi) return true;
  return dogumYili !== null && simdi.getUTCFullYear() - dogumYili > 18;
}

export function sosyalGerekli(k: Kullanici): void {
  if (!k.sosyalAcik) throw new IstemciHatasi("sosyal.veliOnayiGerekli", 403);
}

/** Bearer JWT'yi doğrular (Supabase imza anahtarları) ve kullanıcı kaydını getirir. */
export async function kimlikDogrula(istek: Request): Promise<{ id: string; eposta: string | null }> {
  const baslik = istek.headers.get("authorization") ?? "";
  if (!baslik.startsWith("Bearer ")) throw new IstemciHatasi("giris.oturumYok", 401);
  const jwt = baslik.slice(7);
  const { data, error } = await servisIstemcisi().auth.getClaims(jwt);
  const sub = data?.claims.sub;
  if (error || !sub) throw new IstemciHatasi("giris.oturumYok", 401);
  const eposta = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: sub, eposta };
}

export async function ogrenciGetir(istek: Request): Promise<Kullanici> {
  const k = await kimlikDogrula(istek);
  const { data, error } = await servisIstemcisi()
    .from("kullanici")
    .select("id, dershane_id, tur, ad, soyad, takma_ad, silinme_talebi, dogum_yili, veli_onayi")
    .eq("id", k.id)
    .maybeSingle();
  if (error) throw error;
  if (!data?.dershane_id) throw new IstemciHatasi("giris.oturumYok", 403);
  if (data.silinme_talebi) throw new IstemciHatasi("giris.oturumYok", 403);
  return {
    id: data.id,
    dershaneId: data.dershane_id,
    tur: data.tur,
    yasakliDegerler: [data.ad, data.soyad, data.takma_ad, k.eposta].filter((x): x is string => typeof x === "string" && x.length >= 3),
    sosyalAcik: sosyalAcikMi(data.dogum_yili as number | null, Boolean(data.veli_onayi), data.tur as string),
  };
}

/** Merkez ekibinden belirli yetkiye sahip mi (genel kapsamlı rol)? */
export async function merkezYetkisiVar(kullaniciId: string, yetki: string): Promise<boolean> {
  const s = servisIstemcisi();
  const { data: roller, error } = await s.from("kullanici_rol").select("rol_kod").eq("kullanici_id", kullaniciId).is("dershane_id", null);
  if (error) throw error;
  const kodlar = (roller ?? []).map((r) => r.rol_kod as string);
  if (kodlar.length === 0) return false;
  const { count, error: h2 } = await s
    .from("rol_yetki")
    .select("rol_kod", { count: "exact", head: true })
    .is("dershane_id", null)
    .in("rol_kod", kodlar)
    .eq("yetki_kod", yetki);
  if (h2) throw h2;
  return (count ?? 0) > 0;
}
