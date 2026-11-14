import "server-only";
import { dogruSikSec, FOTO_COZUM_V1, GORSEL_OKUMA_V1, jsonAyikla, soruTipiSec, soruUret, type UretimIstegi } from "@kmy/ai";
import { SIKLAR, sinirla, type Sik } from "@kmy/shared";
import { aiAyarlari, mufredatGetir } from "./ayarlar";
import { IstemciHatasi } from "./http";
import { kmyai, kmyaiErisilebilir } from "./kmyai";
import { servisIstemcisi } from "./supabase";

/** Öğretmen araçları: AI ile ödev/turnuva sorusu ürettirme (onaya düşer) ve fotoğraftan soru okuma. */
export interface Ogretmen { id: string; dershaneId: string }

const GUNLUK_URETIM = 60;

export async function ogretmenGetir(kullaniciId: string, yetki: "soru.ai_uret" | "soru.yukle"): Promise<Ogretmen> {
  const s = servisIstemcisi();
  const [{ data: k }, { data: var_ }] = await Promise.all([
    s.from("kullanici").select("id, dershane_id, tur, silinme_talebi").eq("id", kullaniciId).maybeSingle(),
    s.rpc("sistem_yetkisi_var", { p_kullanici: kullaniciId, p_yetki: yetki }),
  ]);
  if (!k?.dershane_id || k.tur !== "personel" || k.silinme_talebi || var_ !== true) throw new IstemciHatasi("panel.yetkisiz", 403);
  return { id: k.id as string, dershaneId: k.dershane_id as string };
}

function aiHazir() {
  const istemci = kmyai();
  if (!istemci || !kmyaiErisilebilir()) throw new IstemciHatasi("asistan.mesgul", 503);
  return istemci;
}

export async function soruUrettir(o: Ogretmen, g: { kazanimId: string; zorluk: number; adet: number }): Promise<{ uretilen: number; reddedilen: number; idler: string[] }> {
  const istemci = aiHazir();
  const ayar = await aiAyarlari();
  if (ayar.yedekMod || ayar.durdurulan.has("soru_uretim")) throw new IstemciHatasi("asistan.mesgul", 503);
  const m = await mufredatGetir();
  const k = m.kazanimlar.get(g.kazanimId);
  if (!k) throw new IstemciHatasi("soru.kazanimYok", 404);
  const s = servisIstemcisi();
  const bugun = new Date(); bugun.setUTCHours(0, 0, 0, 0);
  const { count } = await s.from("soru").select("id", { count: "exact", head: true }).eq("ogretmen_id", o.id).not("uretici_model", "is", null).gte("olusturma", bugun.toISOString());
  const adet = sinirla(Math.round(g.adet), 1, 5);
  if ((count ?? 0) + adet > GUNLUK_URETIM) throw new IstemciHatasi("ogretmen.gunlukSinir", 429);
  const zorluk = sinirla(Math.round(g.zorluk), 1, 10);
  const sayac: Partial<Record<Sik, number>> = {};
  const ozetler: string[] = [];
  const idler: string[] = [];
  let reddedilen = 0;
  for (let i = 0; i < adet * 2 && idler.length < adet; i++) {
    const dogruSik = dogruSikSec(k.sinav, sayac);
    sayac[dogruSik] = (sayac[dogruSik] ?? 0) + 1;
    const istek: UretimIstegi = {
      kazanimKodu: k.kod, kazanimAciklama: k.aciklama, dersKodu: k.dersKod, dersAd: k.dersAd, sinifDuzeyi: k.sinifDuzeyi,
      sinav: k.sinav, hedefZorluk: zorluk, soruTipi: soruTipiSec(zorluk, k.soruTipiAgirliklari), dogruSik, oncekiOzetler: ozetler,
    };
    const r = await soruUret(
      { istemci, uretimAyari: ayar.gorevler.soru_uretim, dogrulamaAyari: ayar.gorevler.soru_dogrulama, uretimPromptu: ayar.promptlar.soru_uretim, dogrulamaPromptu: ayar.promptlar.soru_dogrulama },
      istek,
    );
    if (r.durum !== "dogrulandi") { reddedilen++; continue; }
    const x = r.soru;
    ozetler.unshift(x.govdeMd.replace(/\s+/g, " ").slice(0, 110));
    const { data, error } = await s.from("soru").insert({
      kaynak: "ogretmen", dershane_id: o.dershaneId, ogretmen_id: o.id, kazanim_id: k.id, sinav_turu: k.sinav, soru_tipi: x.soruTipi,
      zorluk: sinirla(x.zorluk, 1, 10), tahmini_sure_sn: sinirla(x.tahminiSureSn, 10, 400), govde_md: x.govdeMd, siklar: x.siklar, dogru: x.dogru,
      cozum_adimlari: x.cozumAdimlari, celdirici_notlari: x.celdiriciNotlari, ipuclari: x.ipuclari.slice(0, 3),
      prompt_surumu: ayar.promptlar.soru_uretim.surum, uretici_model: r.uretimModeli, dogrulayici_model: r.dogrulayiciModeli,
      durum: "uretildi", paylasim: "kendim",
    }).select("id").single();
    if (error) throw error;
    idler.push(data.id as string);
  }
  return { uretilen: idler.length, reddedilen, idler };
}

/** Fotoğraf / PDF sayfası görüntüsünden soru metni, şıklar ve kazanım önerisi (kaydetmez; öğretmen düzeltip kaydeder). */
export async function fotograftanOku(o: Ogretmen, gorselBase64: string): Promise<Record<string, unknown>> {
  const istemci = aiHazir();
  const ayar = await aiAyarlari();
  const veri = gorselBase64.replace(/^data:image\/\w+;base64,/, "");
  if (!/^[A-Za-z0-9+/=\s]+$/.test(veri) || veri.length < 1000) throw new IstemciHatasi("fotograf.gecersiz");
  if ((veri.length * 3) / 4 > 4_000_000) throw new IstemciHatasi("fotograf.buyuk", 413);
  const m = await mufredatGetir();
  const dersler = [...m.dersKodla.values()];
  const baglam = { dershaneId: o.dershaneId, kullaniciId: o.id };
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
  if (!okuma.soru_mu || !okuma.metin_md) throw new IstemciHatasi("fotograf.soruDegil", 422);
  const siklar: Partial<Record<Sik, string>> = {};
  for (const h of SIKLAR) if (typeof okuma.siklar?.[h] === "string" && okuma.siklar[h]) siklar[h] = okuma.siklar[h].slice(0, 500);
  const ders = dersler.find((d) => d.kod === okuma.ders_kod);
  const kazanimlar = ders ? (m.derseGore.get(ders.id) ?? []) : [];
  let cozum: { kazanim_kod?: string | null; dogru_sik?: string | null; cozum_adimlari?: string[] } = {};
  try {
    const r = await istemci.tamamla({
      gorev: "asistan", ayar: { ...ayar.gorevler.asistan, maxToken: 1500, sicaklik: 0 }, jsonBekleniyor: true, promptSurumu: FOTO_COZUM_V1.surum, baglam,
      mesajlar: [
        { role: "system", content: FOTO_COZUM_V1.metin },
        { role: "user", content: [`SORU:\n${okuma.metin_md}`, `ŞIKLAR:\n${SIKLAR.filter((h) => siklar[h]).map((h) => `${h}) ${siklar[h]}`).join("\n")}`,
          `KAZANIMLAR:\n${kazanimlar.map((x) => `${x.kod}: ${x.aciklama}`).join("\n").slice(0, 9000)}`].join("\n\n") },
      ],
    });
    cozum = jsonAyikla(r.icerik) as typeof cozum;
  } catch {
    cozum = {};
  }
  const kz = cozum.kazanim_kod ? kazanimlar.find((x) => x.kod === cozum.kazanim_kod) : undefined;
  return {
    govde_md: okuma.metin_md.slice(0, 3000), siklar, ders_id: ders?.id ?? null, kazanim_id: kz?.id ?? null,
    dogru: SIKLAR.includes(cozum.dogru_sik as Sik) ? cozum.dogru_sik : null,
    cozum_adimlari: (cozum.cozum_adimlari ?? []).filter((x) => typeof x === "string").slice(0, 8),
  };
}
