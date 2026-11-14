"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { apiCagir } from "@/lib/api";
import { yetkiIste } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";

export interface SoruGirdisi {
  id?: string; kazanimId: string; govde: string; siklar: Record<string, string>; dogru: string; zorluk: number; tip: string;
  cozumAdimlari: string[]; paylasim: "kendim" | "dershane";
  cozum?: { tur: "video" | "gorsel" | "metin" | "baglanti"; yol?: string; url?: string; metin?: string } | null;
}

const SIKLAR = ["A", "B", "C", "D", "E"];

export async function soruKaydet(g: SoruGirdisi): Promise<KayitSonucu & { id?: string }> {
  try {
    const k = await yetkiIste("soru.yukle");
    const siklar = Object.fromEntries(Object.entries(g.siklar).filter(([h, v]) => SIKLAR.includes(h) && v.trim()).map(([h, v]) => [h, v.trim().slice(0, 500)]));
    if (g.govde.trim().length < 10) return { hata: "Soru metni çok kısa." };
    if (Object.keys(siklar).length < 4 || !siklar[g.dogru]) return { hata: "En az 4 şık ve doğru cevap gerekli." };
    const { data: kz } = await servis().from("kazanim").select("id, sinav_turu").eq("id", g.kazanimId).maybeSingle();
    if (!kz) return { hata: "Kazanım seçin." };
    if (g.cozum?.url && !/^https:\/\//.test(g.cozum.url)) return { hata: "Bağlantı https:// ile başlamalı." };
    if (g.cozum?.yol && !g.cozum.yol.startsWith(`${k.dershaneId}/`)) return { hata: hataMetni(new Error("panel.yetkisiz")) };
    const kayit = {
      kazanim_id: kz.id, sinav_turu: kz.sinav_turu, soru_tipi: g.tip || "islem", zorluk: Math.min(10, Math.max(1, Math.round(g.zorluk))),
      govde_md: g.govde.trim().slice(0, 4000), siklar, dogru: g.dogru, cozum_adimlari: g.cozumAdimlari.map((x) => x.trim()).filter(Boolean).slice(0, 10),
      paylasim: g.paylasim, ogretmen_cozum: g.cozum ?? null, durum: "dogrulandi",
    };
    const s = await sunucuIstemcisi();
    const r = g.id
      ? await s.from("soru").update(kayit).eq("id", g.id).select("id").single()
      : await s.from("soru").insert({ ...kayit, kaynak: "ogretmen", dershane_id: k.dershaneId, ogretmen_id: k.kullaniciId }).select("id").single();
    if (r.error) throw new Error(r.error.message);
    revalidatePath("/ogretmen/sorular");
    return { tamam: "Soru kaydedildi.", id: r.data.id as string };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function soruDurum(id: string, durum: "dogrulandi" | "emekli" | "sil" | "paylas" | "kendim"): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const r = durum === "sil" ? await s.from("soru").delete().eq("id", id)
      : durum === "paylas" || durum === "kendim" ? await s.from("soru").update({ paylasim: durum === "paylas" ? "dershane" : "kendim" }).eq("id", id)
      : await s.from("soru").update({ durum }).eq("id", id);
    if (r.error) throw new Error(r.error.message);
    revalidatePath("/ogretmen/sorular");
    return { tamam: "Güncellendi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function aiUret(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const r = await apiCagir<{ uretilen: number; reddedilen: number }>("/api/ogretmen/uret", {
      kazanimId: String(f.get("kazanim") ?? ""), zorluk: Number(f.get("zorluk")) || 5, adet: Number(f.get("adet")) || 3,
    });
    revalidatePath("/ogretmen/sorular");
    return r.uretilen
      ? { tamam: `${r.uretilen} soru üretildi ve onayınıza düştü${r.reddedilen ? ` (${r.reddedilen} soru kontrolü geçemediği için atıldı)` : ""}.` }
      : { hata: "Kontrolü geçen soru üretilemedi, tekrar deneyin." };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return { hata: m === "ogretmen.gunlukSinir" ? "Günlük AI soru sınırına ulaştınız (60)." : m === "asistan.mesgul" ? "AI şu an meşgul, birazdan tekrar deneyin." : hataMetni(e) };
  }
}

export async function fotografOku(gorsel: string): Promise<{ hata?: string; veri?: Record<string, unknown> }> {
  try {
    return { veri: await apiCagir<Record<string, unknown>>("/api/ogretmen/oku", { gorsel }) };
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    const H: Record<string, string> = { "fotograf.uygunsuz": "Görselde yüz veya kişisel bilgi var; yalnız soruyu kırpın.", "fotograf.soruDegil": "Görselde soru bulunamadı.", "fotograf.okunamadi": "Görsel okunamadı.", "fotograf.buyuk": "Görsel çok büyük.", "asistan.mesgul": "AI şu an meşgul." };
    return { hata: H[m] ?? hataMetni(e) };
  }
}

/** Çözüm videosu / görseli için imzalı yükleme adresi (özel depo, dershane klasörü). */
export async function yuklemeAdresi(uzanti: string): Promise<{ hata?: string; yol?: string; token?: string }> {
  try {
    const k = await yetkiIste("soru.yukle");
    if (!/^(mp4|mov|webm|m4v|jpg|jpeg|png|webp)$/.test(uzanti)) return { hata: "Desteklenmeyen dosya türü." };
    const s = servis();
    await s.storage.createBucket("ogretmen", { public: false, fileSizeLimit: 200 * 1024 * 1024 }).catch(() => undefined);
    const yol = `${k.dershaneId}/${k.kullaniciId}/${randomUUID()}.${uzanti}`;
    const { data, error } = await s.storage.from("ogretmen").createSignedUploadUrl(yol);
    if (error) throw new Error(error.message);
    return { yol, token: data.token };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function arsivdenOdev(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const sorular = String(f.get("sorular") ?? "").split(",").filter(Boolean);
    const s = await sunucuIstemcisi();
    const son = String(f.get("son") ?? "");
    const { error } = await s.rpc("panel_odev_arsivden", {
      p_baslik: String(f.get("baslik") ?? "Ödev").slice(0, 120), p_sorular: sorular, p_siniflar: [String(f.get("sinif") ?? "")], p_ogrenciler: null,
      p_son_tarih: son ? new Date(`${son}T23:59:00+03:00`).toISOString() : new Date(Date.now() + 3 * 86400000).toISOString(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/ogretmen/odevler");
    return { tamam: `${sorular.length} soruluk ödev verildi.` };
  } catch (e) {
    return { hata: e instanceof Error && e.message.includes("panel.soruSec") ? "Yalnız onaylı arşiv sorularını seçin (1-50)." : hataMetni(e) };
  }
}
