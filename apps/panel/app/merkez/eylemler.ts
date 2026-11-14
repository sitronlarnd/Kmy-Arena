"use server";

import { revalidatePath } from "next/cache";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { eposta, hesapAc, hosGeldinMetni } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";

const DURUMLAR = ["yeni", "gorusuldu", "demo_yapildi", "pilot", "teklif_verildi", "kazanildi", "kaybedildi"];

export async function teklifGuncelle(f: FormData): Promise<void> {
  const k = await merkezYetkisi("merkez.satis");
  const id = String(f.get("id"));
  const durum = String(f.get("durum"));
  const tarih = String(f.get("sonraki") ?? "") || null;
  if (!DURUMLAR.includes(durum)) throw new Error("Geçersiz durum");
  const { error } = await servis().from("teklif").update({ durum, sonraki_adim_tarihi: tarih }).eq("id", id);
  if (error) throw new Error(error.message);
  await denetle(k, "teklif.durum", id, { durum, tarih });
  revalidatePath("/merkez/teklifler");
}

export async function lisansGuncelle(f: FormData): Promise<void> {
  const k = await merkezYetkisi("merkez.dershane_yonet");
  const id = String(f.get("id"));
  const durum = String(f.get("durum"));
  const limit = Math.max(1, Number(f.get("limit")) || 50);
  const bitis = String(f.get("bitis") ?? "") || null;
  if (!["pilot", "aktif", "gecikmis", "askida", "bitti"].includes(durum)) throw new Error("Geçersiz durum");
  const { error } = await servis().from("dershane").update({ lisans_durumu: durum, ogrenci_limiti: limit, lisans_bitis: bitis }).eq("id", id);
  if (error) throw new Error(error.message);
  await denetle(k, "dershane.lisans", id, { durum, limit, bitis });
  revalidatePath("/merkez/dershaneler");
}


/** Dershane oluşturma sihirbazı: dershane + ilk şube + (isteğe bağlı) örnek sınıflar + kurucu hesabı. */
export async function dershaneOlustur(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await merkezYetkisi("merkez.dershane_yonet");
    const m = (x: string, n = 120) => String(f.get(x) ?? "").trim().slice(0, n);
    const ad = m("ad"), sehir = m("sehir", 60), sube = m("sube", 60) || "Merkez Şube";
    const kAd = m("kurucu_ad", 60), kSoyad = m("kurucu_soyad", 60), kEposta = m("kurucu_eposta", 160).toLowerCase();
    if (ad.length < 2 || !kAd || !kSoyad || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(kEposta)) return { hata: "Dershane adı ve kurucunun ad, soyad, e-postası gerekli." };
    const durum = m("durum", 10);
    if (!["pilot", "aktif"].includes(durum)) return { hata: "Lisans durumu seçin." };
    const renk = /^#[0-9a-fA-F]{6}$/.test(m("renk", 7)) ? m("renk", 7) : "#6D5CFF";
    const s = servis();
    const { data: d, error } = await s.from("dershane").insert({
      ad, sehir: sehir || null, ana_renk: renk, uygulama_ici_ad: m("uygulama_ad", 40) || null, paket_id: m("paket") || null,
      ogrenci_limiti: Math.max(1, Number(f.get("limit")) || 50), lisans_durumu: durum,
      lisans_baslangic: m("baslangic", 10) || new Date().toISOString().slice(0, 10), lisans_bitis: m("bitis", 10) || null,
      ayarlar: { sablon: m("sablon", 10) || "LGS" },
    }).select("id").single();
    if (error || !d) throw new Error(error?.message ?? "dershane oluşturulamadı");
    const { data: sb, error: e2 } = await s.from("sube").insert({ dershane_id: d.id, ad: sube, sehir: sehir || null }).select("id").single();
    if (e2 || !sb) throw new Error(e2?.message ?? "şube oluşturulamadı");
    if (f.get("ornek_sinif") === "on") {
      const sablon = m("sablon", 10);
      const siniflar = [
        ...(sablon !== "YKS" ? [{ ad: "8-A", sinav_turu: "LGS", seviye: 8, yks_alani: null }] : []),
        ...(sablon !== "LGS" ? [{ ad: "12-SAY", sinav_turu: "TYT", seviye: 12, yks_alani: "SAY" }, { ad: "12-EA", sinav_turu: "TYT", seviye: 12, yks_alani: "EA" }] : []),
      ];
      if (siniflar.length) await s.from("sinif").insert(siniflar.map((c) => ({ ...c, dershane_id: d.id, sube_id: sb.id })));
    }
    let h;
    try {
      h = await hesapAc({ ad: kAd, soyad: kSoyad, rol: "kurucu", dershaneId: d.id as string, subeId: null, sinifId: null, eposta: kEposta });
    } catch (e) {
      await s.from("dershane").delete().eq("id", d.id);
      throw e;
    }
    const hg = await hosGeldinMetni(kAd, kEposta, h.sifre, "kurucu", ad);
    const gitti = await eposta(kEposta, hg.konu, hg.govde);
    const teklif = m("teklif");
    if (teklif) await s.from("teklif").update({ durum: durum === "pilot" ? "pilot" : "kazanildi" }).eq("id", teklif);
    await denetle(k, "dershane.olustur", d.id as string, { ad, durum, kurucu: kEposta });
    revalidatePath("/merkez/dershaneler");
    return { tamam: `${ad} oluşturuldu${gitti ? "; giriş bilgileri kurucuya e-postayla gönderildi" : ""}. Kurucu panelden şube, sınıf ve öğrencileri ekleyebilir.`, hesaplar: [h] };
  } catch (e) { return { hata: hataMetni(e) }; }
}
