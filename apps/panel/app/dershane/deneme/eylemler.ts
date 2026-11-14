"use server";

import { revalidatePath } from "next/cache";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { yetkiIste } from "@/lib/hesap";
import { hataMetni } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";
import { normal, tabloOku } from "@/lib/tablo-oku";

export interface Onizleme { hata?: string; basliklar?: string[]; ornek?: string[][]; oneri?: { ogrenciNo: string | null; ad: string | null; soyad: string | null; adSoyad: string | null; dersler: { ders: string; net: string; dogru: string | null; yanlis: string | null }[] } }

/** 1. adım: dosyayı oku, sütunları ve önerilen eşleştirmeyi döndür. */
export async function denemeOnizle(f: FormData): Promise<Onizleme> {
  try {
    await yetkiIste("deneme.ice_aktar");
    const dosya = f.get("dosya");
    if (!(dosya instanceof File) || !dosya.size) return { hata: "Dosya seçin." };
    const satirlar = await tabloOku(dosya);
    const ham = Object.keys(satirlar[0] ?? {});
    const dersler = ham.filter((h) => h.endsWith("net") && h !== "net" && h !== "toplamnet").map((h) => {
      const kok = h.slice(0, -3);
      return { ders: kok, net: h, dogru: ham.find((x) => x === `${kok}d` || x === `${kok}dogru`) ?? null, yanlis: ham.find((x) => x === `${kok}y` || x === `${kok}yanlis`) ?? null };
    });
    return {
      basliklar: ham, ornek: satirlar.slice(0, 5).map((r) => ham.map((h) => r[h] ?? "")),
      oneri: {
        ogrenciNo: ham.find((h) => ["ogrencino", "no", "numara", "okulno", "ogrno"].includes(h) || h.includes("ogrencino")) ?? null,
        ad: ham.find((h) => ["ad", "adi", "isim"].includes(h)) ?? null,
        soyad: ham.find((h) => ["soyad", "soyadi"].includes(h)) ?? null,
        adSoyad: ham.find((h) => h.includes("adsoyad") || h.includes("adisoyadi") || h === "ogrenci" || h === "ogrenciadi") ?? null,
        dersler,
      },
    };
  } catch (e) { return { hata: hataMetni(e) }; }
}

const DERS_ADI: Record<string, string> = { turkce: "Türkçe", matematik: "Matematik", mat: "Matematik", fen: "Fen Bilimleri", fenbilimleri: "Fen Bilimleri", inkilap: "İnkılap Tarihi", tcinkilap: "İnkılap Tarihi", din: "Din Kültürü", dinkulturu: "Din Kültürü", ingilizce: "İngilizce", yabancidil: "Yabancı Dil", sosyal: "Sosyal Bilimler", sosyalbilimler: "Sosyal Bilimler", fizik: "Fizik", kimya: "Kimya", biyoloji: "Biyoloji", tarih: "Tarih", cografya: "Coğrafya", edebiyat: "Edebiyat", felsefe: "Felsefe" };

/** 2. adım: eşleştirmeyle içe aktar. */
export async function denemeIceAktar(f: FormData): Promise<KayitSonucu & { id?: string }> {
  try {
    const k = await yetkiIste("deneme.ice_aktar");
    const dosya = f.get("dosya");
    const es = JSON.parse(String(f.get("eslesme") ?? "{}")) as NonNullable<Onizleme["oneri"]>;
    const ad = String(f.get("ad") ?? "").trim(), tarih = String(f.get("tarih") ?? ""), sinav = String(f.get("sinav") ?? "LGS");
    if (!(dosya instanceof File) || ad.length < 2 || !/^\d{4}-\d{2}-\d{2}$/.test(tarih) || !["LGS", "TYT", "AYT", "YDT"].includes(sinav)) return { hata: "Deneme adı, tarihi, sınav türü ve dosya gerekli." };
    if (!es.dersler?.length || !(es.ogrenciNo || es.adSoyad || (es.ad && es.soyad))) return { hata: "Öğrenci sütununu ve en az bir ders net sütununu eşleştirin." };
    const satirlar = await tabloOku(dosya);
    const s = servis();
    const { data: ogr } = await s.from("kullanici").select("id, ad, soyad, ogrenci_no, sube_id").eq("dershane_id", k.dershaneId).eq("tur", "ogrenci").is("silinme_talebi", null);
    const l = (ogr ?? []).filter((o) => k.tum || k.subeler.includes(o.sube_id as string));
    const noIle = new Map(l.filter((o) => o.ogrenci_no).map((o) => [String(o.ogrenci_no).trim(), o.id as string]));
    const adIle = new Map<string, string | null>();
    for (const o of l) { const a = normal(`${o.ad as string}${o.soyad as string}`); adIle.set(a, adIle.has(a) ? null : (o.id as string)); }
    const sayi = (x: string | undefined) => { const n = Number(String(x ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
    const { data: d, error } = await s.from("deneme").insert({ dershane_id: k.dershaneId, ad: ad.slice(0, 120), tarih, sinav_turu: sinav, olusturan_id: k.kullaniciId }).select("id").single();
    if (error || !d) throw new Error(error?.message);
    const kayit: { deneme_id: string; kullanici_id: string; dershane_id: string; ders: string; dogru: number | null; yanlis: number | null; net: number }[] = [];
    const eslesmeyen: string[] = [];
    for (const r of satirlar) {
      const no = es.ogrenciNo ? (r[es.ogrenciNo] ?? "").trim() : "";
      const isim = es.adSoyad ? (r[es.adSoyad] ?? "") : `${r[es.ad ?? ""] ?? ""} ${r[es.soyad ?? ""] ?? ""}`;
      const id = (no && noIle.get(no)) || adIle.get(normal(isim)) || null;
      if (!id) { if (isim.trim() || no) eslesmeyen.push(isim.trim() || no); continue; }
      for (const x of es.dersler) {
        const net = sayi(r[x.net]);
        if (net === null) continue;
        kayit.push({ deneme_id: d.id as string, kullanici_id: id, dershane_id: k.dershaneId, ders: (DERS_ADI[x.ders] ?? x.ders).slice(0, 60), dogru: x.dogru ? sayi(r[x.dogru]) : null, yanlis: x.yanlis ? sayi(r[x.yanlis]) : null, net });
      }
    }
    if (!kayit.length) { await s.from("deneme").delete().eq("id", d.id); return { hata: "Hiçbir öğrenci eşleşmedi. Öğrenci numarası veya ad soyad sütununu kontrol edin.", hatalar: eslesmeyen.slice(0, 30) }; }
    for (let i = 0; i < kayit.length; i += 500) {
      const { error: e2 } = await s.from("deneme_sonuc").upsert(kayit.slice(i, i + 500));
      if (e2) throw new Error(e2.message);
    }
    revalidatePath("/dershane/deneme");
    const ogrSay = new Set(kayit.map((x) => x.kullanici_id)).size;
    return { tamam: `${ogrSay} öğrencinin sonuçları aktarıldı${eslesmeyen.length ? `; ${eslesmeyen.length} satır eşleşmedi` : ""}.`, hatalar: eslesmeyen.slice(0, 30).map((x) => `Eşleşmedi: ${x}`), id: d.id as string };
  } catch (e) { return { hata: hataMetni(e) }; }
}

export async function dersZayifOdev(sinif: string, ders: string): Promise<KayitSonucu> {
  try {
    const s = await sunucuIstemcisi();
    const { error } = await s.rpc("panel_ders_zayif_odev", { p_sinif: sinif, p_ders_ad: ders });
    if (error) throw new Error(error.message);
    return { tamam: `${ders} için telafi ödevi verildi.` };
  } catch (e) { return { hata: e instanceof Error && e.message.includes("dersBulunamadi") ? "Bu ders platform müfredatıyla eşleşmedi." : hataMetni(e) }; }
}

export async function denemeSil(id: string): Promise<KayitSonucu> {
  try {
    const k = await yetkiIste("deneme.ice_aktar");
    await servis().from("deneme").delete().eq("id", id).eq("dershane_id", k.dershaneId);
    revalidatePath("/dershane/deneme");
    return { tamam: "Silindi." };
  } catch (e) { return { hata: hataMetni(e) }; }
}
