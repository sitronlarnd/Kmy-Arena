import "server-only";
import { amblemGecerli, hazirMesaj, metniDenetle, OYUN_AYARLARI, SIKAYET_SEBEPLERI, type Amblem } from "@kmy/shared";
import { IstemciHatasi } from "./http";
import type { Kullanici } from "./kimlik";
import { servisIstemcisi } from "./supabase";

const K = OYUN_AYARLARI.klan;

function hataCevir(e: { message: string }): never {
  const m = /(klan|sikayet)\.\w+/.exec(e.message)?.[0];
  if (m) throw new IstemciHatasi(m, 409);
  throw new Error(e.message);
}

async function rpc<T>(ad: string, arg: Record<string, unknown>): Promise<T> {
  const { data, error } = await servisIstemcisi().rpc(ad, arg);
  if (error) hataCevir(error);
  return data as T;
}

export const durum = (k: Kullanici) => rpc<Record<string, unknown>>("sistem_klan_durum", { p_kullanici: k.id, p_max_hak: K.savasSaldiriHakki });

export async function kur(k: Kullanici, g: { ad?: unknown; slogan?: unknown; amblem?: unknown; katilim?: unknown }): Promise<{ klanId: string; onayBekliyor: boolean }> {
  const ad = typeof g.ad === "string" ? g.ad.trim().replace(/\s+/g, " ") : "";
  const slogan = typeof g.slogan === "string" ? g.slogan.trim().replace(/\s+/g, " ") : "";
  if (ad.length < 3 || ad.length > 24 || !/^[\p{L}\p{N} .'-]+$/u.test(ad)) throw new IstemciHatasi("klan.adGecersiz");
  if (slogan.length > 60) throw new IstemciHatasi("klan.sloganGecersiz");
  for (const m of [ad, slogan]) if (m && !metniDenetle(m).temiz) throw new IstemciHatasi("klan.uygunsuzMetin");
  const amblem = g.amblem as Partial<Amblem> | undefined;
  if (!amblemGecerli(amblem, 1)) throw new IstemciHatasi("klan.amblemGecersiz");
  const katilim = g.katilim === "basvurulu" || g.katilim === "davet" ? g.katilim : "acik";
  // Dershane ayarı: klan adları öğretmen onayından geçsin mi (varsayılan: filtre yeterli)
  const { data: d } = await servisIstemcisi().from("dershane").select("ayarlar").eq("id", k.dershaneId).single();
  const onayBekle = Boolean((d?.ayarlar as Record<string, unknown> | null)?.klan_onayi);
  const klanId = await rpc<string>("sistem_klan_kur", {
    p_kullanici: k.id, p_ad: ad, p_slogan: slogan, p_amblem: { kalkan: amblem.kalkan, simge: amblem.simge, renk: amblem.renk },
    p_katilim: katilim, p_onay_bekle: onayBekle, p_min_seviye: K.kurmaMinSeviye, p_min_soru: K.kurmaMinSoru7Gun,
  });
  return { klanId, onayBekliyor: onayBekle };
}

export const katil = (k: Kullanici, klanId: string) =>
  rpc<"katildi" | "basvuruldu">("sistem_klan_katil", { p_kullanici: k.id, p_klan: klanId, p_max: K.uyeMax });

export const basvuruYanit = (k: Kullanici, id: string, kabul: boolean) =>
  rpc<null>("sistem_klan_basvuru_yanit", { p_kullanici: k.id, p_basvuru: id, p_kabul: kabul, p_max: K.uyeMax });

export async function davet(k: Kullanici, takmaAd: string): Promise<void> {
  const { data } = await servisIstemcisi()
    .from("kullanici").select("id").eq("dershane_id", k.dershaneId).eq("tur", "ogrenci").ilike("takma_ad", takmaAd.trim()).maybeSingle();
  if (!data) throw new IstemciHatasi("klan.kullaniciYok", 404);
  await rpc("sistem_klan_davet", { p_kullanici: k.id, p_hedef: data.id });
}

export const ayril = (k: Kullanici) => rpc<null>("sistem_klan_ayril", { p_kullanici: k.id });

export function yonet(k: Kullanici, hedef: string, islem: string) {
  if (!["yardimci_yap", "uye_yap", "lider_devret", "cikar"].includes(islem)) throw new IstemciHatasi("ortak.hata");
  return rpc<null>("sistem_klan_yonet", { p_kullanici: k.id, p_hedef: hedef, p_islem: islem });
}

export const mesajlar = (k: Kullanici, sonra: number) =>
  rpc<unknown[]>("sistem_klan_mesajlar", { p_kullanici: k.id, p_sonra: Math.max(0, Math.floor(sonra) || 0), p_limit: 50 });

export async function mesaj(k: Kullanici, g: { tur?: unknown; kod?: unknown; metin?: unknown; soruId?: unknown }): Promise<{ id: number }> {
  const tur = g.tur;
  if (tur === "hazir") {
    if (typeof g.kod !== "string" || !hazirMesaj(g.kod)) throw new IstemciHatasi("klan.mesajGecersiz");
    return { id: await rpc<number>("sistem_klan_mesaj", { p_kullanici: k.id, p_tur: "hazir", p_kod: g.kod, p_metin: null, p_soru: null }) };
  }
  if (tur === "soru") {
    if (typeof g.soruId !== "string" || !/^[0-9a-f-]{36}$/i.test(g.soruId)) throw new IstemciHatasi("klan.mesajGecersiz");
    return { id: await rpc<number>("sistem_klan_mesaj", { p_kullanici: k.id, p_tur: "soru", p_kod: "takildim", p_metin: null, p_soru: g.soruId }) };
  }
  if (tur === "serbest") {
    const metin = typeof g.metin === "string" ? g.metin.trim().replace(/\s+/g, " ") : "";
    if (metin.length < 1 || metin.length > 300) throw new IstemciHatasi("klan.mesajGecersiz");
    const d = metniDenetle(metin);
    if (!d.temiz) throw new IstemciHatasi(`klan.filtre_${d.sebep}`, 422);
    return { id: await rpc<number>("sistem_klan_mesaj", { p_kullanici: k.id, p_tur: "serbest", p_kod: null, p_metin: metin, p_soru: null }) };
  }
  throw new IstemciHatasi("klan.mesajGecersiz");
}

export async function sikayet(k: Kullanici, g: { hedefTur?: unknown; hedefId?: unknown; sebep?: unknown; aciklama?: unknown }): Promise<void> {
  const hedefTur = g.hedefTur === "klan" ? "klan" : "klan_mesaj";
  const hedefId = typeof g.hedefId === "string" || typeof g.hedefId === "number" ? String(g.hedefId) : "";
  if (!hedefId || hedefId.length > 40) throw new IstemciHatasi("sikayet.gecersiz");
  if (hedefTur === "klan_mesaj" && !/^\d+$/.test(hedefId)) throw new IstemciHatasi("sikayet.gecersiz");
  if (hedefTur === "klan" && !/^[0-9a-f-]{36}$/i.test(hedefId)) throw new IstemciHatasi("sikayet.gecersiz");
  const sebep = SIKAYET_SEBEPLERI.includes(g.sebep as (typeof SIKAYET_SEBEPLERI)[number]) ? (g.sebep as string) : "diger";
  await rpc("sistem_sikayet", {
    p_kullanici: k.id, p_hedef_tur: hedefTur, p_hedef_id: hedefId, p_sebep: sebep,
    p_aciklama: typeof g.aciklama === "string" ? g.aciklama.slice(0, 500) : null,
  });
}

/** Cevaptan sonra klan katkısı (sistem_cevap_isle'den sonra; hata cevabı bozmaz). */
export async function katki(
  k: Kullanici,
  x: { dogru: boolean; zorluk: number; beklenen: number; kazanimId: string; ozellik: string | null },
): Promise<KlanKatkiSonucu | null> {
  const { data, error } = await servisIstemcisi().rpc("sistem_klan_katki", {
    p: {
      kullanici_id: k.id, dogru: x.dogru, zorluk: x.zorluk, beklenen: x.beklenen, kazanim_id: x.kazanimId, ozellik: x.ozellik,
      savas_hak: K.savasSaldiriHakki,
    },
  });
  if (error) throw error;
  return (data as KlanKatkiSonucu | null) ?? null;
}

export interface KlanKatkiSonucu {
  klan_id: string;
  seviye: number;
  seviye_atladi: boolean;
  tamamlanan_gorevler: string[];
  boss: { hasar: number; kalan_can: number; can: number; yenildi: boolean; ad: string } | null;
  savas: { bolge: string; etki: number; hak_kalan: number } | null;
}

/** Personel: klan adı/sloganı onayı (Faz 6 panelinde arayüzü) */
export async function onay(personelId: string, klanId: string, kabul: boolean): Promise<void> {
  const s = servisIstemcisi();
  const { data: klan } = await s.from("klan").select("dershane_id").eq("id", klanId).maybeSingle();
  if (!klan) throw new IstemciHatasi("klan.bulunamadi", 404);
  const { data: rol } = await s.from("kullanici_rol").select("rol_kod").eq("kullanici_id", personelId).eq("dershane_id", klan.dershane_id)
    .in("rol_kod", ["kurucu", "sube_muduru", "ogretmen"]);
  if (!rol?.length) throw new IstemciHatasi("klan.yetkisiz", 403);
  await rpc("sistem_klan_onay", { p_klan: klanId, p_onay: kabul });
}
