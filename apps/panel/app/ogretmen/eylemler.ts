"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hataMetni, panelRpc } from "@/lib/panel";

export interface EylemSonucu { tamam?: string; hata?: string }

export async function zayifKonularaOdev(sinif: string | null, ogrenci: string | null): Promise<EylemSonucu> {
  try {
    await panelRpc("panel_zayif_konulara_odev", { p_sinif: sinif, p_ogrenci: ogrenci });
    revalidatePath("/ogretmen/odevler");
    return { tamam: "Ödev oluşturuldu: en zayıf 3 kazanımdan 10 soru, 3 gün süre." };
  } catch (e) {
    return { hata: hataMetni(e) };
  }
}

export async function odevOlustur(_o: EylemSonucu, f: FormData): Promise<EylemSonucu> {
  const kazanimlar = f.getAll("kazanim").map(String);
  const siniflar = f.getAll("sinif").map(String);
  if (kazanimlar.length === 0) return { hata: "En az bir kazanım seç." };
  if (siniflar.length === 0) return { hata: "En az bir sınıf seç." };
  try {
    await panelRpc("panel_odev_olustur", {
      p_baslik: String(f.get("baslik") || "Ödev").slice(0, 120),
      p_kazanimlar: kazanimlar,
      p_siniflar: siniflar,
      p_ogrenciler: [],
      p_soru_sayisi: Math.min(50, Math.max(3, Number(f.get("soru_sayisi")) || 10)),
      p_zorluk_modu: f.get("zorluk_modu") === "sabit" ? "sabit" : "uyarlamali",
      p_sabit_zorluk: Math.min(10, Math.max(1, Number(f.get("sabit_zorluk")) || 5)),
      p_son_tarih: new Date(String(f.get("son_tarih"))).toISOString(),
    });
  } catch (e) {
    return { hata: hataMetni(e) };
  }
  revalidatePath("/ogretmen/odevler");
  redirect("/ogretmen/odevler?yeni=1");
}

export async function karar(f: FormData): Promise<void> {
  await panelRpc("panel_karar", { p_tur: String(f.get("tur")), p_id: String(f.get("id")), p_karar: String(f.get("karar")) });
  revalidatePath("/ogretmen/bekleyenler");
}

export async function toplulukOnay(f: FormData): Promise<void> {
  await panelRpc("panel_topluluk_onay", { p_cevap: String(f.get("cevap")), p_ornek: f.get("ornek") === "1" });
  revalidatePath("/ogretmen/bekleyenler");
}

export async function duyuruGonder(_o: EylemSonucu, f: FormData): Promise<EylemSonucu> {
  const baslik = String(f.get("baslik") ?? "").trim();
  const metin = String(f.get("metin") ?? "").trim();
  if (baslik.length < 2 || metin.length < 1) return { hata: "Başlık ve metin gerekli." };
  const sinif = String(f.get("sinif") ?? "") || null;
  try {
    await panelRpc("panel_duyuru", { p_baslik: baslik.slice(0, 120), p_metin: metin.slice(0, 1000), p_sube: null, p_sinif: sinif });
    return { tamam: "Duyuru öğrencilere iletildi." };
  } catch (e) {
    return { hata: hataMetni(e) };
  }
}

export async function rehberlikNotu(_o: EylemSonucu, f: FormData): Promise<EylemSonucu> {
  const metin = String(f.get("metin") ?? "").trim();
  if (!metin) return { hata: "Not boş olamaz." };
  const plan = String(f.get("plan") ?? "");
  try {
    await panelRpc("panel_rehberlik_not", {
      p_ogrenci: String(f.get("ogrenci")), p_tur: ["gorusme", "hedef"].includes(String(f.get("tur"))) ? f.get("tur") : "not",
      p_metin: metin.slice(0, 2000), p_plan: plan ? new Date(plan).toISOString() : null,
    });
    revalidatePath(`/ogretmen/ogrenci/${String(f.get("ogrenci"))}`);
    return { tamam: "Not kaydedildi." };
  } catch (e) {
    return { hata: hataMetni(e) };
  }
}
