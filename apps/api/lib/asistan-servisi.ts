import "server-only";
import {
  ASISTAN_SOKRATIK_V1, DESTEK_ISARETI, FOTO_COZUM_V1, GORSEL_OKUMA_V1, jsonAyikla, KisiselVeriHatasi, type SohbetMesaji,
} from "@kmy/ai";
import { destekGerekli, SIKLAR, type Sik } from "@kmy/shared";
import { aiAyarlari, mufredatGetir } from "./ayarlar";
import { IstemciHatasi } from "./http";
import type { Kullanici } from "./kimlik";
import { kmyai, kmyaiErisilebilir } from "./kmyai";
import { servisIstemcisi } from "./supabase";

/** Spec: öğrenci başına günlük asistan ve fotoğraf sınırları */
export const ASISTAN_SINIRLARI = { gunlukMesaj: 40, gunlukFotograf: 15, gecmisMesaj: 12, mesajUzunluk: 600, fotografBayt: 2_500_000 } as const;

export const DESTEK_YANITI =
  "Bunu benimle paylaştığın için teşekkür ederim. Yalnız değilsin. Lütfen hemen güvendiğin bir yetişkinle — ailenden biriyle, öğretmeninle ya da dershanendeki rehber öğretmenle — konuş. Acil bir durumdaysan 112'yi arayabilirsin.";

interface Oturum {
  id: string;
  kullanici_id: string;
  tur: "soru" | "fotograf";
  soru_id: string | null;
  fotograf: FotografVerisi | null;
  ipucu_seviyesi: number;
}
interface FotografVerisi {
  metin_md: string;
  siklar: Partial<Record<Sik, string>>;
  ders_kod: string | null;
  kazanim_kod: string | null;
  dogru_sik: Sik | null;
  cozum_adimlari: string[];
  emin: boolean;
}
export interface AsistanMesaji { id: number; rol: "ogrenci" | "asistan"; icerik: string; destek: boolean }

async function ozellikAcik(kod: string, dershaneId: string): Promise<boolean> {
  const { data } = await servisIstemcisi().rpc("sistem_ozellik_acik", { p_kod: kod, p_dershane: dershaneId });
  return data !== false;
}

async function kullanim(k: Kullanici): Promise<{ mesaj: number; fotograf: number }> {
  const { data, error } = await servisIstemcisi().rpc("sistem_asistan_kullanim", { p_kullanici: k.id });
  if (error) throw error;
  return data as { mesaj: number; fotograf: number };
}

async function oturumGetir(k: Kullanici, id: string): Promise<Oturum> {
  const { data } = await servisIstemcisi().from("asistan_oturum").select("id, kullanici_id, tur, soru_id, fotograf, ipucu_seviyesi").eq("id", id).maybeSingle();
  if (!data || data.kullanici_id !== k.id) throw new IstemciHatasi("asistan.oturumYok", 404);
  return data as Oturum;
}

async function mesajlariGetir(oturumId: string): Promise<AsistanMesaji[]> {
  const { data } = await servisIstemcisi().from("asistan_mesaj").select("id, rol, icerik, destek").eq("oturum_id", oturumId).order("id");
  return (data ?? []) as AsistanMesaji[];
}

async function mesajEkle(o: Oturum, k: Kullanici, rol: "ogrenci" | "asistan", icerik: string, destek: boolean, ipucu?: number): Promise<number> {
  const { data, error } = await servisIstemcisi().rpc("sistem_asistan_mesaj_ekle", {
    p_oturum: o.id, p_kullanici: k.id, p_rol: rol, p_icerik: icerik, p_destek: destek, p_ipucu: ipucu ?? null,
  });
  if (error) throw error;
  return data as number;
}

async function rehberligeBildir(k: Kullanici, kaynak: "asistan" | "topluluk"): Promise<void> {
  // İçeriğin kendisi değil, yalnızca kısa bir uyarı: rehber öğretmen öğrenciyle yüz yüze konuşur.
  await servisIstemcisi().rpc("sistem_rehberlik_bildir", {
    p_kullanici: k.id, p_kaynak: kaynak, p_ozet: "Öğrenci mesajında destek gerektirebilecek ifadeler tespit edildi. Lütfen öğrenciyle görüşün.",
  });
}

/** Cevaplanmış bir antrenman sorusu için oturum (varsa son 24 saattekini sürdürür). */
export async function soruOturumu(k: Kullanici, soruId: string) {
  if (!(await ozellikAcik("asistan", k.dershaneId))) throw new IstemciHatasi("asistan.kapali", 403);
  const { data, error } = await servisIstemcisi().rpc("sistem_asistan_soru_oturumu", { p_kullanici: k.id, p_soru: soruId });
  if (error) {
    if (/asistan\.\w+/.test(error.message)) throw new IstemciHatasi(/asistan\.\w+/.exec(error.message)?.[0] ?? "ortak.hata", 409);
    throw error;
  }
  const oturumId = data as string;
  return { oturumId, mesajlar: await mesajlariGetir(oturumId), kalan: ASISTAN_SINIRLARI.gunlukMesaj - (await kullanim(k)).mesaj };
}

export async function oturumDurumu(k: Kullanici, oturumId: string) {
  const o = await oturumGetir(k, oturumId);
  return { oturumId: o.id, tur: o.tur, fotograf: o.fotograf ? fotografOzeti(o.fotograf) : null, mesajlar: await mesajlariGetir(o.id), kalan: ASISTAN_SINIRLARI.gunlukMesaj - (await kullanim(k)).mesaj };
}

function fotografOzeti(f: FotografVerisi) {
  return { metinMd: f.metin_md, siklar: f.siklar, dersKodu: f.ders_kod, kazanimKodu: f.kazanim_kod };
}

/** Gizli referans: sorunun cevabı ve çözümü — asistan yalnızca yönlendirmek için kullanır. */
async function referans(o: Oturum): Promise<string> {
  if (o.tur === "fotograf" && o.fotograf) {
    const f = o.fotograf;
    return [
      `SORU:\n${f.metin_md}`,
      Object.keys(f.siklar).length ? `ŞIKLAR:\n${SIKLAR.filter((h) => f.siklar[h]).map((h) => `${h}) ${f.siklar[h]}`).join("\n")}` : "",
      `GİZLİ DOĞRU CEVAP: ${f.dogru_sik ?? "(şıksız)"}${f.emin ? "" : " (emin değilim)"}`,
      `GİZLİ ÇÖZÜM:\n${f.cozum_adimlari.map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
    ].filter(Boolean).join("\n\n");
  }
  const { data: s } = await servisIstemcisi().from("soru").select("govde_md, siklar, dogru, cozum_adimlari").eq("id", o.soru_id ?? "").maybeSingle();
  if (!s) throw new IstemciHatasi("asistan.oturumYok", 404);
  const siklar = s.siklar as Record<string, string>;
  return [
    `SORU:\n${s.govde_md}`,
    `ŞIKLAR:\n${SIKLAR.filter((h) => siklar[h]).map((h) => `${h}) ${siklar[h]}`).join("\n")}`,
    `GİZLİ DOĞRU CEVAP: ${s.dogru}`,
    `GİZLİ ÇÖZÜM:\n${((s.cozum_adimlari ?? []) as string[]).map((a, i) => `${i + 1}. ${a}`).join("\n")}`,
  ].join("\n\n");
}

/** Öğrenci mesajı → Sokratik yanıt. */
export async function mesajGonder(k: Kullanici, oturumId: string, metinHam: string): Promise<{ yanit: AsistanMesaji; kalan: number }> {
  const o = await oturumGetir(k, oturumId);
  const metin = metinHam.trim().replace(/\s+/g, " ").slice(0, ASISTAN_SINIRLARI.mesajUzunluk);
  if (metin.length < 1) throw new IstemciHatasi("asistan.bosMesaj");
  const kul = await kullanim(k);
  if (kul.mesaj >= ASISTAN_SINIRLARI.gunlukMesaj) throw new IstemciHatasi("asistan.gunlukSinir", 429);

  // Güvenlik: kendine zarar / ciddi sıkıntı → AI'ye gönderilmez
  if (destekGerekli(metin)) {
    await mesajEkle(o, k, "ogrenci", metin, true);
    const id = await mesajEkle(o, k, "asistan", DESTEK_YANITI, true);
    await rehberligeBildir(k, "asistan");
    return { yanit: { id, rol: "asistan", icerik: DESTEK_YANITI, destek: true }, kalan: ASISTAN_SINIRLARI.gunlukMesaj - kul.mesaj - 1 };
  }

  const istemci = kmyai();
  const ayar = await aiAyarlari();
  if (!istemci || ayar.yedekMod || ayar.durdurulan.has("asistan") || !kmyaiErisilebilir()) throw new IstemciHatasi("asistan.mesgul", 503);

  const gecmis = (await mesajlariGetir(o.id)).filter((m) => !m.destek).slice(-ASISTAN_SINIRLARI.gecmisMesaj);
  const ipucu = Math.min(3, o.ipucu_seviyesi + 1);
  const mesajlar: SohbetMesaji[] = [
    { role: "system", content: `${ASISTAN_SOKRATIK_V1.metin}\n\n${await referans(o)}\n\nŞU ANKİ İPUCU SEVİYESİ: ${ipucu} (en fazla bu seviyede yardım et).` },
    ...gecmis.map((m): SohbetMesaji => ({ role: m.rol === "ogrenci" ? "user" : "assistant", content: m.icerik })),
    { role: "user", content: metin },
  ];
  await mesajEkle(o, k, "ogrenci", metin, false);
  let icerik: string;
  try {
    const r = await istemci.tamamla({
      gorev: "asistan", ayar: ayar.gorevler.asistan, mesajlar, promptSurumu: ASISTAN_SOKRATIK_V1.surum,
      baglam: { dershaneId: k.dershaneId, kullaniciId: k.id }, yasakliDegerler: k.yasakliDegerler,
    });
    icerik = r.icerik.trim();
  } catch (h) {
    if (h instanceof KisiselVeriHatasi) throw new IstemciHatasi("asistan.kisiselVeri");
    throw new IstemciHatasi("asistan.mesgul", 503);
  }
  if (icerik.startsWith(DESTEK_ISARETI)) {
    await rehberligeBildir(k, "asistan");
    const id = await mesajEkle(o, k, "asistan", DESTEK_YANITI, true);
    return { yanit: { id, rol: "asistan", icerik: DESTEK_YANITI, destek: true }, kalan: ASISTAN_SINIRLARI.gunlukMesaj - kul.mesaj - 1 };
  }
  const id = await mesajEkle(o, k, "asistan", icerik, false, ipucu);
  return { yanit: { id, rol: "asistan", icerik, destek: false }, kalan: ASISTAN_SINIRLARI.gunlukMesaj - kul.mesaj - 1 };
}

/** "Tam çözüm": AI çağırmadan kayıtlı çözümü verir. */
export async function tamCozum(k: Kullanici, oturumId: string): Promise<{ dogru: Sik | null; adimlar: string[] }> {
  const o = await oturumGetir(k, oturumId);
  await servisIstemcisi().from("asistan_oturum").update({ ipucu_seviyesi: 9 }).eq("id", o.id);
  if (o.tur === "fotograf" && o.fotograf) return { dogru: o.fotograf.dogru_sik, adimlar: o.fotograf.cozum_adimlari };
  const { data: s } = await servisIstemcisi().from("soru").select("dogru, cozum_adimlari").eq("id", o.soru_id ?? "").maybeSingle();
  return { dogru: (s?.dogru as Sik | undefined) ?? null, adimlar: (s?.cozum_adimlari as string[] | undefined) ?? [] };
}

/** Fotoğraftan çöz: oku (görsel model) → güvenlik → kazanım + çözüm. Fotoğraf saklanmaz. */
export async function fotografCoz(k: Kullanici, gorselBase64: string) {
  if (!(await ozellikAcik("fotograftan_coz", k.dershaneId))) throw new IstemciHatasi("asistan.kapali", 403);
  const veri = gorselBase64.replace(/^data:image\/\w+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(veri) || veri.length < 1000) throw new IstemciHatasi("fotograf.gecersiz");
  if ((veri.length * 3) / 4 > ASISTAN_SINIRLARI.fotografBayt) throw new IstemciHatasi("fotograf.buyuk", 413);
  const kul = await kullanim(k);
  if (kul.fotograf >= ASISTAN_SINIRLARI.gunlukFotograf) throw new IstemciHatasi("fotograf.gunlukSinir", 429);

  const istemci = kmyai();
  const ayar = await aiAyarlari();
  if (!istemci || ayar.yedekMod || ayar.durdurulan.has("gorsel_okuma") || !kmyaiErisilebilir()) throw new IstemciHatasi("asistan.mesgul", 503);

  const s = servisIstemcisi();
  const { data: derslerHam } = await s.rpc("sistem_ogrenci_dersleri", { p_kullanici: k.id });
  const dersler = (derslerHam ?? []) as Array<{ id: string; kod: string; ad: string }>;
  const baglam = { dershaneId: k.dershaneId, kullaniciId: k.id };

  let okuma: { soru_mu?: boolean; yuz_var?: boolean; kisisel_bilgi_var?: boolean; uygunsuz?: boolean; metin_md?: string; siklar?: Record<string, string>; ders_kod?: string | null };
  try {
    const r = await istemci.tamamla({
      gorev: "gorsel_okuma", ayar: ayar.gorevler.gorsel_okuma, jsonBekleniyor: true, promptSurumu: GORSEL_OKUMA_V1.surum, baglam,
      mesajlar: [
        { role: "system", content: GORSEL_OKUMA_V1.metin },
        { role: "user", content: [
          { type: "text", text: `Ders kodları: ${dersler.map((d) => `${d.kod} (${d.ad})`).join(", ")}` },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${veri}` } },
        ] },
      ],
    });
    okuma = jsonAyikla(r.icerik) as typeof okuma;
  } catch {
    throw new IstemciHatasi("fotograf.okunamadi", 422);
  }
  if (okuma.yuz_var || okuma.kisisel_bilgi_var || okuma.uygunsuz) throw new IstemciHatasi("fotograf.uygunsuz", 422);
  if (!okuma.soru_mu || !okuma.metin_md || okuma.metin_md.length < 8) throw new IstemciHatasi("fotograf.soruDegil", 422);

  const siklar: Partial<Record<Sik, string>> = {};
  for (const h of SIKLAR) if (typeof okuma.siklar?.[h] === "string" && okuma.siklar[h]) siklar[h] = okuma.siklar[h].slice(0, 500);
  const ders = dersler.find((d) => d.kod === okuma.ders_kod) ?? null;
  const mufredat = await mufredatGetir();
  const kazanimlar = ders ? (mufredat.derseGore.get(ders.id) ?? []) : [];

  let cozum: { kazanim_kod?: string | null; dogru_sik?: string | null; cozum_adimlari?: string[]; emin?: boolean } = {};
  try {
    const r = await istemci.tamamla({
      gorev: "asistan", ayar: { ...ayar.gorevler.asistan, maxToken: 1500, sicaklik: 0 }, jsonBekleniyor: true, promptSurumu: FOTO_COZUM_V1.surum, baglam,
      mesajlar: [
        { role: "system", content: FOTO_COZUM_V1.metin },
        { role: "user", content: [
          `SORU:\n${okuma.metin_md}`,
          Object.keys(siklar).length ? `ŞIKLAR:\n${SIKLAR.filter((h) => siklar[h]).map((h) => `${h}) ${siklar[h]}`).join("\n")}` : "",
          `KAZANIMLAR:\n${kazanimlar.map((x) => `${x.kod}: ${x.aciklama}`).join("\n").slice(0, 9000)}`,
        ].filter(Boolean).join("\n\n") },
      ],
    });
    cozum = jsonAyikla(r.icerik) as typeof cozum;
  } catch {
    cozum = { cozum_adimlari: [], emin: false };
  }
  const kazanim = cozum.kazanim_kod ? kazanimlar.find((x) => x.kod === cozum.kazanim_kod) : undefined;
  const fotograf: FotografVerisi = {
    metin_md: okuma.metin_md.slice(0, 3000),
    siklar,
    ders_kod: ders?.kod ?? null,
    kazanim_kod: kazanim?.kod ?? null,
    dogru_sik: SIKLAR.includes(cozum.dogru_sik as Sik) ? (cozum.dogru_sik as Sik) : null,
    cozum_adimlari: (cozum.cozum_adimlari ?? []).filter((x) => typeof x === "string").slice(0, 8).map((x) => x.slice(0, 600)),
    emin: cozum.emin !== false,
  };
  const { data: oturumId, error } = await s.rpc("sistem_asistan_fotograf_oturumu", { p_kullanici: k.id, p_fotograf: fotograf });
  if (error) throw error;
  return {
    oturumId: oturumId as string,
    ...fotografOzeti(fotograf),
    kazanimAciklama: kazanim?.aciklama ?? null,
    dersAd: ders?.ad ?? null,
    cozumVar: fotograf.cozum_adimlari.length > 0,
    kalan: ASISTAN_SINIRLARI.gunlukFotograf - kul.fotograf - 1,
  };
}
