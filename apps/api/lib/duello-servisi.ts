import "server-only";
import { kanallar, SupabaseSunucuYayinci } from "@kmy/realtime";
import {
  beklenenBasari,
  duelloTurSuresiSn,
  hedefPuan,
  OYUN_AYARLARI,
  puandanZorluga,
  SIKLAR,
  sikSayisi,
  zorluktanPuana,
  type SinavTuru,
} from "@kmy/shared";
import { after } from "next/server";
import { mufredatGetir, oyunAyarlari } from "./ayarlar";
import { havuzuDoldur } from "./havuz";
import { IstemciHatasi } from "./http";
import type { Kullanici } from "./kimlik";
import { ortam } from "./ortam";
import { izinliDersler } from "./soru-servisi";
import { servisIstemcisi } from "./supabase";

const DAVET_ALFABE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function davetKodu(): string {
  return Array.from({ length: 6 }, () => DAVET_ALFABE[Math.floor(Math.random() * DAVET_ALFABE.length)]).join("");
}

function hataCevir(e: { message: string }): never {
  const m = /(duello|canli)\.\w+/.exec(e.message)?.[0];
  if (m) throw new IstemciHatasi(m, 409);
  throw new Error(e.message);
}

let yayinci: SupabaseSunucuYayinci | null = null;
/** Rakibin istemcisini uyandırır (veri taşımaz; istemci durumu API'den alır). */
export function duelloDurtu(id: string): void {
  after(async () => {
    try {
      const e = ortam();
      yayinci ??= new SupabaseSunucuYayinci({ supabaseUrl: e.SUPABASE_URL, servisAnahtari: e.SUPABASE_SERVICE_ROLE_KEY });
      await yayinci.yayinla(kanallar.duello(id), "guncellendi", {});
    } catch {
      // Yayın düşerse istemci yoklamayla (1 sn) zaten günceller
    }
  });
}

/** Ders: verilen (kapsamda olmalı) ya da dereceli için sıradaki ders (döngüsel). */
async function dersSec(k: Kullanici, dersKodu: string | undefined): Promise<{ id: string; sinav: SinavTuru }> {
  const [izinli, m] = await Promise.all([izinliDersler(k), mufredatGetir()]);
  if (dersKodu) {
    const d = m.dersKodla.get(dersKodu);
    if (!d || !izinli.has(d.id)) throw new IstemciHatasi("soru.kapsamDisi", 403);
    return { id: d.id, sinav: d.sinav as SinavTuru };
  }
  const liste = [...m.dersKodla.values()].filter((d) => izinli.has(d.id));
  const s = servisIstemcisi();
  const { data } = await s.from("ogrenci_ilerleme").select("ders_dongusu").eq("kullanici_id", k.id).maybeSingle();
  const sira = (data?.ders_dongusu ?? 0) % liste.length;
  await s.from("ogrenci_ilerleme").update({ ders_dongusu: sira + 1 }).eq("kullanici_id", k.id);
  const d = liste[sira] ?? liste[0];
  if (!d) throw new IstemciHatasi("soru.paketYok", 403);
  return { id: d.id, sinav: d.sinav as SinavTuru };
}

async function dersTheta(kullaniciId: string, dersId: string): Promise<number> {
  const m = await mufredatGetir();
  const kz = (m.derseGore.get(dersId) ?? []).map((x) => x.id);
  const { data } = await servisIstemcisi().from("beceri").select("theta").eq("kullanici_id", kullaniciId).in("kazanim_id", kz);
  const liste = (data ?? []).map((r) => Number(r.theta));
  return liste.length ? liste.reduce((a, b) => a + b, 0) / liste.length : OYUN_AYARLARI.beceri.baslangicTheta;
}

interface SoruOzeti { id: string; zorluk: number; olculmus_zorluk: number | null; tahmini_sure_sn: number; dogru: string }

/** 5 soru seçer; havuz yetmezse arka planda üretimi tetikler ve hata verir. */
async function sorularSec(a: string, b: string | null, dersId: string, theta: number): Promise<SoruOzeti[]> {
  const a_ = await oyunAyarlari();
  const hedef = Math.round(puandanZorluga(hedefPuan(theta, a_.duello.hedefBasari), a_));
  const s = servisIstemcisi();
  const { data, error } = await s.rpc("sistem_duello_sorulari", { p_a: a, p_b: b, p_ders: dersId, p_hedef: hedef, p_adet: a_.duello.soruSayisi });
  if (error) throw error;
  const idler = (data ?? []) as string[];
  if (idler.length < a_.duello.soruSayisi) {
    const m = await mufredatGetir();
    const kz = (m.derseGore.get(dersId) ?? [])[0];
    if (kz) after(() => havuzuDoldur(kz.id, Math.ceil(hedef / 2), 3).then(() => undefined).catch(() => undefined));
    throw new IstemciHatasi("duello.soruYok", 409);
  }
  const { data: sorular } = await s.from("soru").select("id, zorluk, olculmus_zorluk, tahmini_sure_sn, dogru").in("id", idler);
  const harita = new Map(((sorular ?? []) as SoruOzeti[]).map((x) => [x.id, x]));
  return idler.map((id) => harita.get(id)).filter((x): x is SoruOzeti => Boolean(x));
}

async function olustur(p: {
  k: Kullanici; mod: "dereceli" | "arkadas" | "robot" | "asenkron"; ders: { id: string; sinav: SinavTuru }; b: string | null;
}): Promise<{ id: string; davetKodu: string | null }> {
  const a_ = await oyunAyarlari();
  const theta = p.b ? ((await dersTheta(p.k.id, p.ders.id)) + (await dersTheta(p.b, p.ders.id))) / 2 : await dersTheta(p.k.id, p.ders.id);
  const sorular = await sorularSec(p.k.id, p.b, p.ders.id, theta);
  const sureler = sorular.map((x) => duelloTurSuresiSn(x.tahmini_sure_sn, a_));
  let robot: Array<{ sure_ms: number; dogru: boolean; secilen: string }> | null = null;
  if (p.mod === "robot") {
    const harfler = SIKLAR.slice(0, sikSayisi(p.ders.sinav));
    robot = sorular.map((x, i) => {
      const e = beklenenBasari(theta, zorluktanPuana(Number(x.olculmus_zorluk ?? x.zorluk), a_));
      const dogru = Math.random() < e;
      const yanlislar = harfler.filter((h) => h !== x.dogru);
      return {
        sure_ms: Math.round(Math.min((sureler[i] ?? 30) * 1000 - 1500, x.tahmini_sure_sn * 1000 * (0.35 + Math.random() * 0.55))),
        dogru,
        secilen: dogru ? x.dogru : (yanlislar[Math.floor(Math.random() * yanlislar.length)] ?? "A"),
      };
    });
  }
  const kod = p.mod === "arkadas" && !p.b ? davetKodu() : null;
  const { data, error } = await servisIstemcisi().rpc("sistem_duello_olustur", {
    p_mod: p.mod, p_dershane: p.k.dershaneId, p_ders: p.ders.id, p_a: p.k.id, p_b: p.b,
    p_sorular: sorular.map((x) => x.id), p_sureler: sureler, p_robot: robot, p_robot_theta: robot ? theta : null, p_davet_kodu: kod,
  });
  if (error) hataCevir(error);
  return { id: data as string, davetKodu: kod };
}

/** Oyuncunun süren (son 2 dk içinde başlamış) canlı düellosu. */
async function aktifDuello(k: Kullanici): Promise<string | null> {
  const { data } = await servisIstemcisi()
    .from("duello")
    .select("id")
    .in("mod", ["dereceli", "arkadas", "robot"])
    .eq("durum", "oynaniyor")
    .or(`a.eq.${k.id},b.eq.${k.id}`)
    .gte("baslangic", new Date(Date.now() - 120_000).toISOString())
    .order("baslangic", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Dereceli kuyruk: istemci ~2 sn'de bir çağırır. Eşleşince düello kurulur. */
export async function kuyruk(k: Kullanici, dersKodu?: string): Promise<{ durum: "eslesti"; duelloId: string } | { durum: "bekliyor"; bekleme: number }> {
  const var_ = await aktifDuello(k);
  if (var_) return { durum: "eslesti", duelloId: var_ };
  const s = servisIstemcisi();
  const { data: mevcut } = await s.from("duello_kuyruk").select("ders_id, giris").eq("kullanici_id", k.id).maybeSingle();
  const ders = mevcut && !dersKodu ? await dersBul(mevcut.ders_id as string) : await dersSec(k, dersKodu);
  const { data: rakip, error } = await s.rpc("sistem_duello_eslestir", { p_kullanici: k.id, p_ders: ders.id });
  if (error) throw error;
  if (rakip) {
    const d = await olustur({ k, mod: "dereceli", ders, b: rakip as string });
    duelloDurtu(d.id);
    return { durum: "eslesti", duelloId: d.id };
  }
  const bekleme = mevcut ? Math.round((Date.now() - new Date(mevcut.giris as string).getTime()) / 1000) : 0;
  return { durum: "bekliyor", bekleme };
}

async function dersBul(id: string): Promise<{ id: string; sinav: SinavTuru }> {
  const m = await mufredatGetir();
  const d = [...m.dersKodla.values()].find((x) => x.id === id);
  if (!d) throw new IstemciHatasi("soru.kazanimYok", 404);
  return { id: d.id, sinav: d.sinav as SinavTuru };
}

export async function kuyruktanCik(k: Kullanici): Promise<void> {
  await servisIstemcisi().from("duello_kuyruk").delete().eq("kullanici_id", k.id);
}

export async function robotDuello(k: Kullanici, dersKodu?: string): Promise<{ duelloId: string }> {
  await kuyruktanCik(k);
  const d = await olustur({ k, mod: "robot", ders: await dersSec(k, dersKodu), b: null });
  return { duelloId: d.id };
}

export async function davetOlustur(k: Kullanici, dersKodu?: string): Promise<{ duelloId: string; davetKodu: string }> {
  const d = await olustur({ k, mod: "arkadas", ders: await dersSec(k, dersKodu), b: null });
  return { duelloId: d.id, davetKodu: d.davetKodu ?? "" };
}

export async function davetKatil(k: Kullanici, kod: string): Promise<{ duelloId: string }> {
  const { data, error } = await servisIstemcisi().rpc("sistem_duello_katil", { p_kod: kod.trim().toUpperCase(), p_kullanici: k.id });
  if (error) hataCevir(error);
  duelloDurtu(data as string);
  return { duelloId: data as string };
}

/** Asenkron: aynı dershanedeki bir öğrenciye (takma adla) 24 saatlik meydan okuma. */
export async function asenkronOlustur(k: Kullanici, takmaAd: string, dersKodu?: string): Promise<{ duelloId: string }> {
  const { data: rakip } = await servisIstemcisi()
    .from("kullanici")
    .select("id")
    .eq("dershane_id", k.dershaneId)
    .eq("tur", "ogrenci")
    .ilike("takma_ad", takmaAd.trim())
    .maybeSingle();
  if (!rakip || rakip.id === k.id) throw new IstemciHatasi("duello.rakipYok", 404);
  const ders = await dersSec(k, dersKodu);
  const rakipDersleri = await izinliDersler({ ...k, id: rakip.id as string });
  if (!rakipDersleri.has(ders.id)) throw new IstemciHatasi("duello.rakipKapsamDisi", 409);
  const d = await olustur({ k, mod: "asenkron", ders, b: rakip.id as string });
  return { duelloId: d.id };
}

export async function durum(k: Kullanici, id: string): Promise<unknown> {
  const a_ = await oyunAyarlari();
  const { data, error } = await servisIstemcisi().rpc("sistem_duello_durum", { p_id: id, p_kullanici: k.id, p_kupa_k: a_.duello.kupaK });
  if (error) hataCevir(error);
  return data;
}

export async function cevapla(k: Kullanici, id: string, sira: number, secilen: string | null, rttMs: number): Promise<unknown> {
  const a_ = await oyunAyarlari();
  const { data, error } = await servisIstemcisi().rpc("sistem_duello_cevap", {
    p_id: id, p_kullanici: k.id, p_sira: sira, p_secilen: secilen, p_rtt_ms: Math.max(0, Math.min(5000, Math.round(rttMs))), p_kupa_k: a_.duello.kupaK,
  });
  if (error) hataCevir(error);
  duelloDurtu(id);
  return data;
}

export async function sekme(k: Kullanici, id: string): Promise<number> {
  const a_ = await oyunAyarlari();
  const { data, error } = await servisIstemcisi().rpc("sistem_duello_sekme", { p_id: id, p_kullanici: k.id, p_kupa_k: a_.duello.kupaK });
  if (error) hataCevir(error);
  duelloDurtu(id);
  return data as number;
}

export async function tepki(k: Kullanici, id: string, kod: string): Promise<void> {
  const { error } = await servisIstemcisi().rpc("sistem_duello_tepki", { p_id: id, p_kullanici: k.id, p_kod: kod });
  if (error) hataCevir(error);
  duelloDurtu(id);
}

/** Rövanş: aynı ders ve rakiple arkadaş daveti; rakip eski düellonun ekranından katılır. */
export async function rovans(k: Kullanici, eskiId: string): Promise<{ duelloId: string; davetKodu: string }> {
  const s = servisIstemcisi();
  const { data: eski } = await s.from("duello").select("id, a, b, mod, ders_id, durum, rovans_id").eq("id", eskiId).maybeSingle();
  if (!eski || (eski.a !== k.id && eski.b !== k.id) || eski.durum !== "bitti") throw new IstemciHatasi("duello.bulunamadi", 404);
  if (eski.mod === "robot") {
    const d = await olustur({ k, mod: "robot", ders: await dersBul(eski.ders_id as string), b: null });
    return { duelloId: d.id, davetKodu: "" };
  }
  if (eski.rovans_id) {
    const { data: r } = await s.from("duello").select("id, davet_kodu, durum").eq("id", eski.rovans_id).maybeSingle();
    if (r?.durum === "davet") return { duelloId: r.id as string, davetKodu: r.davet_kodu as string };
  }
  const ders = await dersBul(eski.ders_id as string);
  const d = await olustur({ k, mod: "arkadas", ders, b: null });
  await s.rpc("sistem_duello_rovans_bagla", { p_eski: eskiId, p_yeni: d.id });
  duelloDurtu(eskiId);
  return { duelloId: d.id, davetKodu: d.davetKodu ?? "" };
}

/** Son düellolar (bekleyen asenkronlar dahil). */
export async function gecmis(k: Kullanici): Promise<unknown[]> {
  const { data } = await servisIstemcisi()
    .from("duello")
    .select("id, mod, durum, a, b, skor_a, skor_b, kazanan, kupa_a, kupa_b, olusturma, son_kullanma, davet_kodu")
    .or(`a.eq.${k.id},b.eq.${k.id}`)
    .neq("durum", "iptal")
    .order("olusturma", { ascending: false })
    .limit(20);
  return (data ?? []).map((d) => {
    const ben = d.a === k.id ? "a" : "b";
    return {
      id: d.id, mod: d.mod, durum: d.durum, olusturma: d.olusturma, sonKullanma: d.son_kullanma, davetKodu: ben === "a" ? d.davet_kodu : null,
      skorBen: ben === "a" ? d.skor_a : d.skor_b, skorRakip: ben === "a" ? d.skor_b : d.skor_a,
      sonuc: d.kazanan === null ? null : d.kazanan === "berabere" ? "berabere" : d.kazanan === ben ? "kazandi" : "kaybetti",
      kupa: ben === "a" ? d.kupa_a : d.kupa_b,
    };
  });
}

/** Turnuva: düellosu açılmamış hazır maçlar için 24 saatlik (asenkron) düello açar; süresi dolanları sonuçlandırır. */
export async function turnuvaMaclariniHazirla(): Promise<{ acilan: number; suresiDolan: number; hata: number }> {
  const s = servisIstemcisi();
  const { data: dolan } = await s.rpc("sistem_turnuva_sure_doldu");
  const { data, error } = await s.rpc("sistem_turnuva_hazir_maclar");
  if (error) throw error;
  const m = await mufredatGetir();
  const dersler = new Map([...m.dersKodla.values()].map((d) => [d.id, d]));
  let acilan = 0, hata = 0;
  for (const x of (data ?? []) as { mac_id: string; dershane_id: string; ders_id: string; a: string; b: string; turnuva: string }[]) {
    try {
      const ders = dersler.get(x.ders_id);
      if (!ders) throw new Error("ders yok");
      const k: Kullanici = { id: x.a, dershaneId: x.dershane_id, tur: "ogrenci", yasakliDegerler: [], sosyalAcik: true };
      const d = await olustur({ k, mod: "asenkron", ders: { id: ders.id, sinav: ders.sinav as SinavTuru }, b: x.b });
      await s.rpc("sistem_turnuva_mac_bagla", { p_mac: x.mac_id, p_duello: d.id, p_a: x.a, p_b: x.b, p_ad: x.turnuva });
      acilan++;
    } catch (e) {
      hata++;
      console.error("turnuva maçı açılamadı", x.mac_id, e);
    }
  }
  return { acilan, suresiDolan: Number(dolan ?? 0), hata };
}
