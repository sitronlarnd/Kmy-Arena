"use server";

import { revalidatePath } from "next/cache";
import { hataMetni, panelRpc } from "@/lib/panel";
import type { EylemSonucu } from "@/app/ogretmen/eylemler";

export async function ayarKaydet(_o: EylemSonucu, f: FormData): Promise<EylemSonucu> {
  try {
    await panelRpc("panel_ayar_guncelle", {
      p_ayarlar: {
        canli_saat: String(f.get("canli_saat") ?? ""),
        gunluk_hedef: Number(f.get("gunluk_hedef")),
        sessiz_baslangic: String(f.get("sessiz_baslangic") ?? ""),
        sessiz_bitis: String(f.get("sessiz_bitis") ?? ""),
        karsilama: String(f.get("karsilama") ?? ""),
        klan_onayi: f.get("klan_onayi") === "on",
        klan_sohbeti_serbest: f.get("klan_sohbeti_serbest") === "on",
        dershaneler_arasi_lig: f.get("dershaneler_arasi_lig") === "on",
      },
    });
    revalidatePath("/dershane/ayarlar");
    return { tamam: "Ayarlar kaydedildi." };
  } catch (e) {
    return { hata: hataMetni(e) };
  }
}

export async function genelDuyuru(_o: EylemSonucu, f: FormData): Promise<EylemSonucu> {
  const baslik = String(f.get("baslik") ?? "").trim();
  const metin = String(f.get("metin") ?? "").trim();
  if (baslik.length < 2 || !metin) return { hata: "Başlık ve metin gerekli." };
  try {
    await panelRpc("panel_duyuru", { p_baslik: baslik.slice(0, 120), p_metin: metin.slice(0, 1000), p_sube: String(f.get("sube") ?? "") || null, p_sinif: null });
    return { tamam: "Duyuru gönderildi." };
  } catch (e) {
    return { hata: hataMetni(e) };
  }
}

export async function rehberlikDurum(f: FormData): Promise<void> {
  await panelRpc("panel_rehberlik_guncelle", { p_tur: String(f.get("tur")), p_id: String(f.get("id")), p_durum: String(f.get("durum") ?? "goruldu") });
  revalidatePath("/dershane/rehberlik");
}
