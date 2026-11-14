"use server";

import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { yetkiIste } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";

export async function etkinlikEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("odul.yonet");
    const ad = String(f.get("ad") ?? "").trim(), bas = String(f.get("baslangic") ?? ""), bit = String(f.get("bitis") ?? "");
    if (ad.length < 2 || !bas) return { hata: "Ad ve başlangıç tarihi gerekli." };
    const siniflar = f.getAll("sinif").map(String).filter(Boolean);
    const s = await sunucuIstemcisi();
    const { error } = await s.from("etkinlik").insert({
      dershane_id: k.dershaneId, ad: ad.slice(0, 120), aciklama: String(f.get("aciklama") ?? "").slice(0, 1000) || null, tur: String(f.get("tur") ?? "diger"),
      baslangic: new Date(`${bas}:00+03:00`).toISOString(), bitis: bit ? new Date(`${bit}:00+03:00`).toISOString() : null,
      sinif_ids: siniflar.length ? siniflar : null, ders_id: String(f.get("ders") ?? "") || null, odul: String(f.get("odul") ?? "").slice(0, 200) || null, olusturan_id: k.kullaniciId,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dershane/odul");
    return { tamam: "Etkinlik eklendi; öğrenciler Arena'da görecek." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function etkinlikSil(id: string): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.from("etkinlik").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dershane/odul");
    return { tamam: "Silindi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function odulEkle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("odul.yonet");
    const s = await sunucuIstemcisi();
    const { error } = await s.from("odul").insert({
      dershane_id: k.dershaneId, kaynak: String(f.get("kaynak") ?? "diger"), baslik: String(f.get("baslik") ?? "").trim().slice(0, 120),
      kazanan_id: String(f.get("kazanan") ?? "") || null, odul: String(f.get("odul") ?? "").trim().slice(0, 200),
    });
    if (error) throw new Error(error.code === "23514" ? "Başlık ve ödül gerekli." : error.message);
    revalidatePath("/dershane/odul");
    return { tamam: "Ödül kaydedildi." };
  } catch (e) { return { hata: e instanceof Error && e.message.startsWith("Başlık") ? e.message : hataMetni(e) }; }
}

export async function teslimEt(id: string, teslim: boolean): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.from("odul").update({ teslim: teslim ? new Date().toISOString() : null }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dershane/odul");
    return { tamam: teslim ? "Teslim edildi olarak işaretlendi." : "Geri alındı." };
  } catch (e) { return { hata: hataMetni(e) }; }
}
