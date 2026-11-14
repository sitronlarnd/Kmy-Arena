"use server";

import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { hataMetni } from "@/lib/panel";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";

interface Satir { kod: string; aciklama?: string; unite_kod?: string; on_kosullar?: string[]; soru_tipi_agirliklari?: Record<string, number> }

async function oku(f: FormData): Promise<Satir[]> {
  const d = f.get("dosya");
  if (!(d instanceof File)) throw new Error("JSON dosyası seçin.");
  const j = JSON.parse(await d.text()) as unknown;
  const l = Array.isArray(j) ? j : (j as { kazanimlar?: unknown }).kazanimlar;
  if (!Array.isArray(l)) throw new Error("Biçim: [{kod, aciklama, unite_kod?, on_kosullar?, soru_tipi_agirliklari?}] ya da {kazanimlar: [...]}");
  return (l as Satir[]).filter((x) => typeof x?.kod === "string");
}

/** Önizleme: kaç kazanım değişecek / eklenecek, kaç öğrencinin beceri kaydı etkilenir. */
export async function mufredatOnizle(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    await merkezYetkisi("merkez.mufredat_yonet");
    const l = await oku(f);
    const s = servis();
    const { data: mevcut } = await s.from("kazanim").select("id, kod, aciklama").in("kod", l.map((x) => x.kod));
    const m = new Map((mevcut ?? []).map((x) => [x.kod as string, x]));
    const degisen = l.filter((x) => m.has(x.kod) && x.aciklama && x.aciklama !== m.get(x.kod)?.aciklama);
    const yeni = l.filter((x) => !m.has(x.kod));
    const ids = degisen.map((x) => m.get(x.kod)?.id as string);
    const { count } = ids.length ? await s.from("beceri").select("kullanici_id", { count: "exact", head: true }).in("kazanim_id", ids) : { count: 0 };
    return { tamam: `${l.length} satır okundu: ${degisen.length} kazanımın açıklaması değişecek, ${yeni.length} yeni kazanım eklenecek (ünite kodu gerekli). Etkilenen beceri kaydı: ${count ?? 0}.`,
      hatalar: [...degisen.slice(0, 15).map((x) => `${x.kod}: "${(m.get(x.kod)?.aciklama as string)?.slice(0, 60)}" → "${x.aciklama?.slice(0, 60)}"`), ...yeni.slice(0, 15).map((x) => `YENİ ${x.kod} (${x.unite_kod ?? "ünite yok!"})`)] };
  } catch (e) { return { hata: e instanceof Error ? e.message : hataMetni(e) }; }
}

export async function mufredatUygula(_o: KayitSonucu, f: FormData): Promise<KayitSonucu> {
  try {
    const k = await merkezYetkisi("merkez.mufredat_yonet");
    const l = await oku(f);
    const s = servis();
    const kodlar = [...new Set(l.flatMap((x) => [x.kod, ...(x.on_kosullar ?? [])]))];
    const { data: kz } = await s.from("kazanim").select("id, kod").in("kod", kodlar);
    const idOf = new Map((kz ?? []).map((x) => [x.kod as string, x.id as string]));
    const { data: un } = await s.from("unite").select("id, kod, sinif_duzeyi, ders:ders_id(sinav_turu)");
    const uniteOf = new Map(((un ?? []) as unknown as { id: string; kod: string; sinif_duzeyi: number; ders: { sinav_turu: string } | null }[]).map((u) => [u.kod, u]));
    let g = 0, e = 0;
    const hatalar: string[] = [];
    for (const x of l) {
      const on = (x.on_kosullar ?? []).map((c) => idOf.get(c)).filter((v): v is string => Boolean(v));
      const kayit: Record<string, unknown> = { panel_duzenleme: true, ...(x.aciklama ? { aciklama: x.aciklama.slice(0, 600) } : {}), ...(x.on_kosullar ? { on_kosullar: on } : {}), ...(x.soru_tipi_agirliklari ? { soru_tipi_agirliklari: x.soru_tipi_agirliklari } : {}) };
      if (idOf.has(x.kod)) { const { error } = await s.from("kazanim").update(kayit).eq("kod", x.kod); if (error) hatalar.push(`${x.kod}: ${error.message}`); else g++; }
      else {
        const u = x.unite_kod ? uniteOf.get(x.unite_kod) : undefined;
        if (!u || !x.aciklama) { hatalar.push(`${x.kod}: yeni kazanım için unite_kod ve aciklama gerekli`); continue; }
        const { error } = await s.from("kazanim").insert({ ...kayit, kod: x.kod, unite_id: u.id, sinif_duzeyi: u.sinif_duzeyi, sinav_turu: u.ders?.sinav_turu ?? "LGS", sira: 999 });
        if (error) hatalar.push(`${x.kod}: ${error.message}`); else e++;
      }
    }
    await denetle(k, "mufredat.ice_aktar", "kazanim", { guncellenen: g, eklenen: e });
    return { tamam: `${g} kazanım güncellendi, ${e} kazanım eklendi.`, hatalar };
  } catch (err) { return { hata: err instanceof Error ? err.message : hataMetni(err) }; }
}
