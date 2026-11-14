import "server-only";
import { jsonAyikla, TOPLULUK_COZUM_V1, TOPLULUK_DEGERLENDIRME_V1, TOPLULUK_IPUCU_V1, GORSEL_OKUMA_V1, type SohbetMesaji } from "@kmy/ai";
import { destekGerekli, metniDenetle, SIKAYET_SEBEPLERI, SIKLAR } from "@kmy/shared";
import { aiAyarlari } from "./ayarlar";
import { IstemciHatasi } from "./http";
import { sosyalGerekli, yazmaGerekli, type Kullanici } from "./kimlik";
import { ekKelimeDenetle } from "./moderasyon";
import { kmyai, kmyaiErisilebilir } from "./kmyai";
import { servisIstemcisi } from "./supabase";

/** Spec: ilk kabul 50 XP + 20 Altın, sonraki 20 XP; günlük topluluk XP sınırı; günlük soru sınırı */
export const TOPLULUK_AYARLARI = {
  ilkXp: 50, ilkAltin: 20, sonrakiXp: 20, gunlukXp: 300, soranXp: 10, gunlukSoru: 10,
  ipucuDk: 15, cozumDk: 120, cronLimit: 4, gorselBayt: 2_500_000,
} as const;
const KOVA = "topluluk";

function hataCevir(e: { message: string }): never {
  const m = /(topluluk|sikayet)\.\w+/.exec(e.message)?.[0];
  if (m) throw new IstemciHatasi(m, 409);
  throw new Error(e.message);
}
async function rpc<T>(ad: string, arg: Record<string, unknown>): Promise<T> {
  const { data, error } = await servisIstemcisi().rpc(ad, arg);
  if (error) hataCevir(error);
  return data as T;
}
async function ozellikAcik(dershaneId: string): Promise<boolean> {
  const { data } = await servisIstemcisi().rpc("sistem_ozellik_acik", { p_kod: "topluluk", p_dershane: dershaneId });
  return data !== false;
}

async function metinDenetle(metin: string, k: Kullanici): Promise<void> {
  const d = metniDenetle(metin);
  if (!d.temiz) throw new IstemciHatasi(`klan.filtre_${d.sebep}`, 422);
  await ekKelimeDenetle(metin, k.dershaneId);
  if (destekGerekli(metin)) {
    void servisIstemcisi().rpc("sistem_rehberlik_bildir", {
      p_kullanici: k.id, p_kaynak: "topluluk", p_ozet: "Toplulukta yazdığı metinde destek gerektirebilecek ifadeler tespit edildi. Lütfen öğrenciyle görüşün.",
    });
  }
}

/**
 * Görsel yükleme: görsel model yüz / kişisel bilgi / uygunsuzluk kontrolü yapar;
 * geçerse özel kovaya yazılır. Okunan metin AI değerlendirmesi için saklanır.
 */
async function gorselYukle(k: Kullanici, base64: string): Promise<{ yol: string; metin: string | null }> {
  const veri = base64.replace(/^data:image\/\w+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(veri) || veri.length < 1000) throw new IstemciHatasi("fotograf.gecersiz");
  const bayt = Buffer.from(veri, "base64");
  if (bayt.length > TOPLULUK_AYARLARI.gorselBayt) throw new IstemciHatasi("fotograf.buyuk", 413);
  const istemci = kmyai();
  const ayar = await aiAyarlari();
  if (!istemci || ayar.yedekMod || !kmyaiErisilebilir()) throw new IstemciHatasi("asistan.mesgul", 503);
  let okuma: { yuz_var?: boolean; kisisel_bilgi_var?: boolean; uygunsuz?: boolean; metin_md?: string };
  try {
    const r = await istemci.tamamla({
      gorev: "gorsel_okuma", ayar: ayar.gorevler.gorsel_okuma, jsonBekleniyor: true, promptSurumu: GORSEL_OKUMA_V1.surum,
      baglam: { dershaneId: k.dershaneId, kullaniciId: k.id },
      mesajlar: [
        { role: "system", content: GORSEL_OKUMA_V1.metin },
        { role: "user", content: [{ type: "text", text: "Ders kodları: (gerekmez)" }, { type: "image_url", image_url: { url: `data:image/jpeg;base64,${veri}` } }] },
      ],
    });
    okuma = jsonAyikla(r.icerik) as typeof okuma;
  } catch {
    throw new IstemciHatasi("fotograf.okunamadi", 422);
  }
  if (okuma.yuz_var || okuma.kisisel_bilgi_var || okuma.uygunsuz) throw new IstemciHatasi("fotograf.uygunsuz", 422);
  const s = servisIstemcisi();
  await s.storage.createBucket(KOVA, { public: false, fileSizeLimit: TOPLULUK_AYARLARI.gorselBayt }).catch(() => undefined);
  const yol = `${k.dershaneId}/${k.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await s.storage.from(KOVA).upload(yol, bayt, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`görsel yüklenemedi: ${error.message}`);
  return { yol, metin: okuma.metin_md?.slice(0, 3000) ?? null };
}

async function imzala<T extends { gorsel_yol?: string | null }>(x: T): Promise<T & { gorsel_url: string | null }> {
  if (!x.gorsel_yol) return { ...x, gorsel_url: null };
  const { data } = await servisIstemcisi().storage.from(KOVA).createSignedUrl(x.gorsel_yol, 3600);
  return { ...x, gorsel_url: data?.signedUrl ?? null };
}

export async function sor(k: Kullanici, g: { dersId?: unknown; kazanimId?: unknown; metin?: unknown; gorsel?: unknown; gorunurluk?: unknown }): Promise<{ id: string }> {
  sosyalGerekli(k);
  yazmaGerekli(k);
  if (!(await ozellikAcik(k.dershaneId))) throw new IstemciHatasi("topluluk.kapali", 403);
  const metin = typeof g.metin === "string" ? g.metin.trim() : "";
  if (metin.length < 5 || metin.length > 2000) throw new IstemciHatasi("topluluk.metinGecersiz");
  if (typeof g.dersId !== "string" || !/^[0-9a-f-]{36}$/i.test(g.dersId)) throw new IstemciHatasi("topluluk.dersGecersiz");
  const kazanimId = typeof g.kazanimId === "string" && /^[0-9a-f-]{36}$/i.test(g.kazanimId) ? g.kazanimId : null;
  await metinDenetle(metin, k);
  const gorunurluk = g.gorunurluk === "sinif" || g.gorunurluk === "sube" ? g.gorunurluk : "dershane";
  const gorsel = typeof g.gorsel === "string" && g.gorsel.length > 0 ? await gorselYukle(k, g.gorsel) : null;
  const id = await rpc<string>("sistem_topluluk_sor", {
    p_kullanici: k.id, p_ders: g.dersId, p_kazanim: kazanimId, p_metin: metin, p_gorsel_yol: gorsel?.yol ?? null,
    p_gorsel_metin: gorsel?.metin ?? null, p_gorunurluk: gorunurluk, p_gunluk_max: TOPLULUK_AYARLARI.gunlukSoru,
  });
  return { id };
}

export const akis = (k: Kullanici, g: { filtre?: unknown; dersId?: unknown; once?: unknown }) =>
  rpc<unknown[]>("sistem_topluluk_akis", {
    p_kullanici: k.id,
    p_filtre: ["acik", "benim", "cevapladiklarim"].includes(String(g.filtre)) ? g.filtre : "hepsi",
    p_ders: typeof g.dersId === "string" && /^[0-9a-f-]{36}$/i.test(g.dersId) ? g.dersId : null,
    p_once: typeof g.once === "string" && !Number.isNaN(Date.parse(g.once)) ? g.once : null,
    p_limit: 20,
  });

interface Detay { gorsel_yol: string | null; cevaplar: Array<{ gorsel_yol: string | null }> }
export async function detay(k: Kullanici, soruId: string) {
  const d = await rpc<Detay>("sistem_topluluk_detay", { p_kullanici: k.id, p_soru: soruId });
  const s = await imzala(d);
  return { ...s, cevaplar: await Promise.all(d.cevaplar.map((c) => imzala(c))) };
}

/** Cevap: kaydedilir, AI ön değerlendirmesi arka planda (after) yapılır. */
export async function cevapla(k: Kullanici, g: { soruId?: unknown; sik?: unknown; aciklama?: unknown; gorsel?: unknown }): Promise<{ id: string }> {
  sosyalGerekli(k);
  yazmaGerekli(k);
  if (typeof g.soruId !== "string" || !/^[0-9a-f-]{36}$/i.test(g.soruId)) throw new IstemciHatasi("topluluk.bulunamadi", 404);
  const aciklama = typeof g.aciklama === "string" ? g.aciklama.trim() : "";
  if (aciklama.length < 10 || aciklama.length > 2000) throw new IstemciHatasi("topluluk.aciklamaKisa");
  await metinDenetle(aciklama, k);
  const sik = SIKLAR.includes(g.sik as never) ? (g.sik as string) : null;
  const gorsel = typeof g.gorsel === "string" && g.gorsel.length > 0 ? await gorselYukle(k, g.gorsel) : null;
  const id = await rpc<string>("sistem_topluluk_cevapla", { p_kullanici: k.id, p_soru: g.soruId, p_sik: sik, p_aciklama: aciklama, p_gorsel_yol: gorsel?.yol ?? null });
  return { id };
}

export async function cevabiDegerlendir(cevapId: string): Promise<void> {
  const s = servisIstemcisi();
  const { data: c } = await s.from("topluluk_cevap").select("id, sik, aciklama, cevaplayan_id, dershane_id, soru:soru_id (metin, gorsel_metin)").eq("id", cevapId).maybeSingle();
  if (!c) return;
  const soru = (Array.isArray(c.soru) ? c.soru[0] : c.soru) as { metin: string; gorsel_metin: string | null } | null;
  const istemci = kmyai();
  const ayar = await aiAyarlari();
  if (!istemci || !soru || ayar.yedekMod || ayar.durdurulan.has("topluluk_degerlendirme") || !kmyaiErisilebilir()) {
    await s.rpc("sistem_topluluk_ai_sonuc", { p_cevap: cevapId, p_dogru: null, p_yeterli: null, p_not: null, p_hata: true });
    return;
  }
  try {
    const r = await istemci.tamamla({
      gorev: "topluluk_degerlendirme", ayar: ayar.gorevler.topluluk_degerlendirme, jsonBekleniyor: true, promptSurumu: TOPLULUK_DEGERLENDIRME_V1.surum,
      baglam: { dershaneId: c.dershane_id, kullaniciId: c.cevaplayan_id },
      mesajlar: [
        { role: "system", content: TOPLULUK_DEGERLENDIRME_V1.metin },
        { role: "user", content: `SORU:\n${soru.metin}${soru.gorsel_metin ? `\n\nFOTOĞRAFTAKİ METİN:\n${soru.gorsel_metin}` : ""}\n\nCEVAP${c.sik ? ` (seçilen şık: ${c.sik})` : ""}:\n${c.aciklama}` },
      ],
    });
    const j = jsonAyikla(r.icerik) as { dogru_gorunuyor?: boolean; aciklama_yeterli?: boolean; uygunsuz?: boolean; not?: string };
    await s.rpc("sistem_topluluk_ai_sonuc", { p_cevap: cevapId, p_dogru: j.dogru_gorunuyor ?? null, p_yeterli: j.aciklama_yeterli ?? null, p_not: j.not ?? null, p_hata: false });
    if (j.uygunsuz) await s.from("topluluk_cevap").update({ gizli: true }).eq("id", cevapId);
  } catch {
    await s.rpc("sistem_topluluk_ai_sonuc", { p_cevap: cevapId, p_dogru: null, p_yeterli: null, p_not: null, p_hata: true });
  }
}

export const kabul = (k: Kullanici, cevapId: string) =>
  rpc<{ xp: number; altin: number; ilk: boolean; donduruldu: boolean }>("sistem_topluluk_kabul", {
    p_kabul_eden: k.id, p_cevap: cevapId, p_kim: "soran", p_ornek: false,
    p_ilk_xp: TOPLULUK_AYARLARI.ilkXp, p_ilk_altin: TOPLULUK_AYARLARI.ilkAltin, p_sonraki_xp: TOPLULUK_AYARLARI.sonrakiXp,
    p_gunluk_xp: TOPLULUK_AYARLARI.gunlukXp, p_soran_xp: TOPLULUK_AYARLARI.soranXp,
  });

/** Öğretmen onayı (her zaman üstün; örnek çözüm işaretleyebilir) — panelden de çağrılır. */
export const ogretmenKabul = (personelId: string, cevapId: string, ornek: boolean) =>
  rpc<{ xp: number; altin: number }>("sistem_topluluk_kabul", {
    p_kabul_eden: personelId, p_cevap: cevapId, p_kim: "ogretmen", p_ornek: ornek,
    p_ilk_xp: TOPLULUK_AYARLARI.ilkXp, p_ilk_altin: TOPLULUK_AYARLARI.ilkAltin, p_sonraki_xp: TOPLULUK_AYARLARI.sonrakiXp,
    p_gunluk_xp: TOPLULUK_AYARLARI.gunlukXp, p_soran_xp: TOPLULUK_AYARLARI.soranXp,
  });

export async function sikayet(k: Kullanici, g: { hedefTur?: unknown; hedefId?: unknown; sebep?: unknown }): Promise<void> {
  const tur = g.hedefTur === "topluluk_cevap" ? "topluluk_cevap" : "topluluk_soru";
  if (typeof g.hedefId !== "string" || !/^[0-9a-f-]{36}$/i.test(g.hedefId)) throw new IstemciHatasi("sikayet.gecersiz");
  const sebep = SIKAYET_SEBEPLERI.includes(g.sebep as never) ? (g.sebep as string) : "diger";
  await rpc("sistem_sikayet", { p_kullanici: k.id, p_hedef_tur: tur, p_hedef_id: g.hedefId, p_sebep: sebep, p_aciklama: null });
}

/** Cron: 15 dk cevapsız → ipucu, 2 saat çözümsüz → tam çözüm (öğretmen onayına). */
export async function aiBekleyenleriIsle(): Promise<{ islenen: number; hata: number }> {
  const s = servisIstemcisi();
  const istemci = kmyai();
  const ayar = await aiAyarlari();
  if (!istemci || ayar.yedekMod || !kmyaiErisilebilir()) return { islenen: 0, hata: 0 };
  const { data } = await s.rpc("sistem_topluluk_ai_bekleyenler", { p_ipucu_dk: TOPLULUK_AYARLARI.ipucuDk, p_cozum_dk: TOPLULUK_AYARLARI.cozumDk, p_limit: TOPLULUK_AYARLARI.cronLimit });
  let islenen = 0;
  let hata = 0;
  for (const x of (data ?? []) as Array<{ id: string; dershane_id: string; metin: string; gorsel_metin: string | null; ders: string; kazanim: string | null; tur: "ipucu" | "cozum" }>) {
    if (!kmyaiErisilebilir()) break;
    const p = x.tur === "cozum" ? TOPLULUK_COZUM_V1 : TOPLULUK_IPUCU_V1;
    const mesajlar: SohbetMesaji[] = [
      { role: "system", content: p.metin },
      { role: "user", content: `DERS: ${x.ders}${x.kazanim ? ` · KAZANIM: ${x.kazanim}` : ""}\n\nSORU:\n${x.metin}${x.gorsel_metin ? `\n\nFOTOĞRAFTAKİ METİN:\n${x.gorsel_metin}` : ""}` },
    ];
    try {
      const r = await istemci.tamamla({
        gorev: "asistan", ayar: { ...ayar.gorevler.asistan, maxToken: x.tur === "cozum" ? 1500 : 300 }, mesajlar, promptSurumu: p.surum,
        baglam: { dershaneId: x.dershane_id, kullaniciId: null },
      });
      await s.rpc("sistem_topluluk_ai_yaz", { p_soru: x.id, p_tur: x.tur, p_metin: r.icerik.trim() });
      islenen++;
    } catch {
      hata++;
    }
  }
  return { islenen, hata };
}
