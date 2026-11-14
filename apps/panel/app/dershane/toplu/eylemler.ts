"use server";

import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { yetkiIste } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";

export async function topluSinif(ogrenciler: string[], sinifId: string): Promise<KayitSonucu> {
  try {
    const { data: c } = await servis().from("sinif").select("id, sube_id, dershane_id").eq("id", sinifId).maybeSingle();
    if (!c) return { hata: "Sınıf seçin." };
    await yetkiIste("ogrenci.ekle", c.sube_id as string);
    const s = await sunucuIstemcisi();
    const { error: e1 } = await s.from("sinif_uyelik").delete().in("kullanici_id", ogrenciler).eq("rol", "ogrenci");
    if (e1) throw e1;
    const { error: e2 } = await s.from("sinif_uyelik").insert(ogrenciler.map((o) => ({ dershane_id: c.dershane_id, sinif_id: c.id, kullanici_id: o, rol: "ogrenci" })));
    if (e2) throw e2;
    await servis().from("kullanici").update({ sube_id: c.sube_id }).in("id", ogrenciler).eq("dershane_id", c.dershane_id);
    revalidatePath("/dershane/toplu");
    return { tamam: `${ogrenciler.length} öğrenci taşındı.` };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function topluDuyuru(ogrenciler: string[], baslik: string, metin: string): Promise<KayitSonucu> {
  try {
    if (baslik.trim().length < 2 || !metin.trim()) return { hata: "Başlık ve metin gerekli." };
    const s = await sunucuIstemcisi();
    const { error } = await s.rpc("panel_duyuru_ogrencilere", { p_baslik: baslik.trim(), p_metin: metin.trim(), p_ogrenciler: ogrenciler });
    if (error) throw new Error(error.message);
    return { tamam: `${ogrenciler.length} öğrenciye duyuru gönderildi.` };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function topluOdev(ogrenciler: string[]): Promise<KayitSonucu> {
  const s = await sunucuIstemcisi();
  let n = 0;
  for (const o of ogrenciler) {
    const { error } = await s.rpc("panel_zayif_konulara_odev", { p_sinif: null, p_ogrenci: o });
    if (!error) n++;
  }
  return n ? { tamam: `${n} öğrenciye kişisel zayıf konular ödevi verildi${n < ogrenciler.length ? ` (${ogrenciler.length - n} öğrencinin yeterli verisi yok)` : ""}.` } : { hata: "Seçilen öğrencilerin yeterli çözüm verisi yok." };
}

export async function yilSonu(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const islemler = [...f.keys()].filter((k) => k.startsWith("islem_")).map((k) => {
      const sinif = k.slice(6), islem = String(f.get(k));
      return islem === "kal" ? null : islem.startsWith("tasi:") ? { sinif, islem: "tasi", hedef: islem.slice(5) } : { sinif, islem };
    }).filter(Boolean);
    if (!islemler.length) return { hata: "Hiçbir sınıf için işlem seçilmedi." };
    const s = await sunucuIstemcisi();
    const { data, error } = await s.rpc("panel_yil_sonu", { p_islemler: islemler });
    if (error) throw new Error(error.message);
    const r = data as { seviye: number; tasi: number; mezun: number };
    revalidatePath("/dershane/yapi");
    return { tamam: `Yıl sonu tamamlandı: ${r.seviye} sınıfın seviyesi yükseltildi, ${r.tasi} sınıf taşındı, ${r.mezun} sınıf mezun arşivine alındı.` };
  } catch (e) { return { hata: hataMetni(e) }; }
}
