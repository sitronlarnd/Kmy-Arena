/**
 * Soru üretim hattı: istek → üret → kalite filtreleri → sayısal kontrol →
 * doğrulayıcı modelle bağımsız çözüm → dogrulandi / reddedildi.
 *
 * Doğrulayıcının cevabı üreticininkiyle eşleşmeyen soru ASLA havuza girmez.
 * Bu modül veritabanı bilmez; sonucu çağıran (apps/api) kaydeder.
 */

import { SIKLAR, sikSayisi, SORU_TIPLERI, type Sik, type SinavTuru, type SoruTipi } from "@kmy/shared";
import { evaluate } from "mathjs";
import type { GorevAyari } from "./gorevler";
import type { KmyaiIstemci, SohbetMesaji } from "./kmyai-istemci";
import type { PromptSurumu } from "./promptlar/soru-uretim";

export interface UretimIstegi {
  kazanimKodu: string;
  kazanimAciklama: string;
  dersKodu: string;
  dersAd: string;
  sinifDuzeyi: number;
  sinav: SinavTuru;
  hedefZorluk: number;
  soruTipi: SoruTipi;
  /** Doğru şık harfi hat tarafından seçilir: harf dağılımı dengeli olur */
  dogruSik: Sik;
  /** Aynı kazanımdaki son soruların kısa özetleri (tekrar olmasın) */
  oncekiOzetler: readonly string[];
}

export interface UretilenSoru {
  kazanimKodu: string;
  sinav: SinavTuru;
  zorluk: number;
  tahminiSureSn: number;
  soruTipi: SoruTipi;
  govdeMd: string;
  siklar: Partial<Record<Sik, string>>;
  dogru: Sik;
  cozumAdimlari: string[];
  celdiriciNotlari: Partial<Record<Sik, string>>;
  ipuclari: string[];
  sayisalKontrol: { ifade: string; sonuc: string } | null;
}

export interface DogrulamaSonucu {
  cevap: Sik | null;
  tekDogruMu: boolean;
  kazanimUygun: boolean;
  sorunlar: string[];
  zorlukTahmini: number | null;
}

export type HatSonucu =
  | {
      durum: "dogrulandi";
      soru: UretilenSoru;
      dogrulama: DogrulamaSonucu;
      uretimModeli: string;
      dogrulayiciModeli: string;
      sureMs: number;
    }
  | {
      durum: "reddedildi";
      /** Üretildiyse kayıt için soru (reddedilen sorular da istatistik için saklanır) */
      soru: UretilenSoru | null;
      redNedeni: string;
      asama: "uretim" | "bicim" | "kalite" | "sayisal" | "dogrulama";
      uretimModeli: string | null;
      dogrulayiciModeli: string | null;
      sureMs: number;
    };

// ── JSON ayıklama ────────────────────────────────────────────────────

/** Model bazen ```json ... ``` veya önüne/arkasına metin ekler; ilk dengeli { … } bloğunu alır. */
export function jsonAyikla(metin: string): unknown {
  const temiz = metin.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  const bas = temiz.indexOf("{");
  if (bas < 0) throw new Error("JSON bulunamadı");
  let derinlik = 0;
  let tirnak = false;
  let kacis = false;
  for (let i = bas; i < temiz.length; i++) {
    const c = temiz[i];
    if (tirnak) {
      if (kacis) kacis = false;
      else if (c === "\\") kacis = true;
      else if (c === '"') tirnak = false;
      continue;
    }
    if (c === '"') tirnak = true;
    else if (c === "{") derinlik++;
    else if (c === "}") {
      derinlik--;
      if (derinlik === 0) return JSON.parse(temiz.slice(bas, i + 1));
    }
  }
  throw new Error("JSON eksik kapanmış");
}

const nesne = (d: unknown): d is Record<string, unknown> => typeof d === "object" && d !== null && !Array.isArray(d);
const metinMi = (d: unknown): d is string => typeof d === "string" && d.trim().length > 0;
const sikMi = (d: unknown): d is Sik => typeof d === "string" && (SIKLAR as readonly string[]).includes(d);

/** Üretici çıktısını tipli nesneye çevirir; biçim hatasında açıklamalı hata fırlatır. */
export function uretilenSoruyuCoz(icerik: string, istek: UretimIstegi): UretilenSoru {
  const v = jsonAyikla(icerik);
  if (!nesne(v)) throw new Error("kök nesne değil");
  const siklarHam = v.siklar;
  if (!nesne(siklarHam)) throw new Error("siklar nesne değil");
  const siklar: Partial<Record<Sik, string>> = {};
  for (const [k, d] of Object.entries(siklarHam)) {
    if (!sikMi(k)) throw new Error(`geçersiz şık harfi ${k}`);
    if (!metinMi(d)) throw new Error(`${k} şıkkı boş`);
    siklar[k] = d.trim();
  }
  if (!sikMi(v.dogru)) throw new Error("dogru alanı geçersiz");
  if (!metinMi(v.govde_md)) throw new Error("govde_md boş");
  const dizi = (d: unknown): string[] => (Array.isArray(d) ? d.filter(metinMi).map((x) => x.trim()) : []);
  const celdirici: Partial<Record<Sik, string>> = {};
  if (nesne(v.celdirici_notlari)) {
    for (const [k, d] of Object.entries(v.celdirici_notlari)) if (sikMi(k) && metinMi(d)) celdirici[k] = d.trim();
  }
  const zorluk = Math.round(Number(v.zorluk));
  const sure = Math.round(Number(v.tahmini_sure_sn));
  const tip = (SORU_TIPLERI as readonly string[]).includes(String(v.soru_tipi)) ? (v.soru_tipi as SoruTipi) : istek.soruTipi;
  let sayisal: UretilenSoru["sayisalKontrol"] = null;
  if (nesne(v.sayisal_kontrol) && metinMi(v.sayisal_kontrol.ifade) && v.sayisal_kontrol.sonuc !== undefined) {
    sayisal = { ifade: v.sayisal_kontrol.ifade, sonuc: String(v.sayisal_kontrol.sonuc) };
  }
  return {
    kazanimKodu: istek.kazanimKodu,
    sinav: istek.sinav,
    zorluk: Number.isFinite(zorluk) ? zorluk : istek.hedefZorluk,
    tahminiSureSn: Number.isFinite(sure) ? sure : 60,
    soruTipi: tip,
    govdeMd: v.govde_md.trim(),
    siklar,
    dogru: v.dogru,
    cozumAdimlari: dizi(v.cozum_adimlari),
    celdiriciNotlari: celdirici,
    ipuclari: dizi(v.ipuclari),
    sayisalKontrol: sayisal,
  };
}

// ── Kalite filtreleri ────────────────────────────────────────────────

const OLUMSUZ = /(değildir|yanlıştır|olamaz|söylenemez|ulaşılamaz)/iu;
// Kaba ön eleme; asıl içerik denetimi doğrulayıcı modelde. (Kimya/tarih terimleri burada YOK.)
const UYGUNSUZ = /(intihar|uyuşturucu|kumar)/iu;

/** Matematik ve **kalın** bölgeler dışındaki metin (olumsuz kök denetimi için). */
function kalinDisi(md: string): string {
  return md.replace(/\*\*[^*]+\*\*/g, " ").replace(/\$\$[\s\S]*?\$\$|\$[^$]*\$/g, " ");
}

/** Boş liste = geçti. Her eleman bir red nedenidir. */
export function kaliteKontrolu(s: UretilenSoru, istek: UretimIstegi): string[] {
  const n: string[] = [];
  const beklenenHarfler = SIKLAR.slice(0, sikSayisi(istek.sinav));
  const harfler = Object.keys(s.siklar);
  if (harfler.length !== beklenenHarfler.length || !beklenenHarfler.every((h) => h in s.siklar)) {
    n.push(`şık sayısı ${harfler.length}, beklenen ${beklenenHarfler.join("")}`);
  }
  if (s.dogru !== istek.dogruSik) n.push(`doğru şık ${s.dogru}, istenen ${istek.dogruSik}`);
  const metinler = Object.values(s.siklar).map((x) => x.replace(/\s+/g, " ").trim().toLocaleLowerCase("tr-TR"));
  if (new Set(metinler).size !== metinler.length) n.push("aynı metne sahip şıklar var");
  const uzunluklar = metinler.map((x) => x.length);
  const enUzun = Math.max(...uzunluklar);
  const enKisa = Math.min(...uzunluklar);
  if (enUzun > 12 && enUzun > enKisa * 3.5) n.push("şık uzunlukları dengesiz");
  const dogruUzunluk = (s.siklar[s.dogru] ?? "").length;
  if (enUzun > 30 && dogruUzunluk === enUzun && uzunluklar.filter((u) => u === enUzun).length === 1 && dogruUzunluk > 1.6 * enKisa) {
    n.push("doğru şık belirgin biçimde en uzun");
  }
  if (s.govdeMd.length < 15) n.push("soru metni çok kısa");
  if (s.govdeMd.length > 2500) n.push("soru metni çok uzun");
  if ((s.govdeMd.match(/(?<!\\)\$/g)?.length ?? 0) % 2 !== 0) n.push("LaTeX $ işaretleri dengesiz");
  // Yalnızca soru kökü (metnin son cümlesi) denetlenir; anlatımdaki olumsuzluk serbest.
  const kok = kalinDisi(s.govdeMd).trim().split(/(?<=[.!:\n])\s+/).pop() ?? "";
  if (OLUMSUZ.test(kok)) n.push("olumsuz soru kökü kalın yazılmamış");
  if (UYGUNSUZ.test([s.govdeMd, ...Object.values(s.siklar)].join(" "))) n.push("uygunsuz içerik şüphesi");
  if (s.zorluk < 1 || s.zorluk > 10) n.push("zorluk 1-10 dışında");
  if (Math.abs(s.zorluk - istek.hedefZorluk) > 2) n.push(`zorluk ${s.zorluk}, hedef ${istek.hedefZorluk}`);
  if (s.tahminiSureSn < 10 || s.tahminiSureSn > 400) n.push("tahmini süre makul değil");
  if (s.cozumAdimlari.length < 1) n.push("çözüm adımı yok");
  if (s.ipuclari.length < 3) n.push("3 ipucu yok");
  return n;
}

// ── Sayısal kontrol (mathjs) ─────────────────────────────────────────

function sayiyaCevir(metin: string): number | null {
  const temiz = metin
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/[${}\\]/g, "")
    .replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2") // Türkçe binlik ayırıcı
    .replace(/(\d),(\d)/g, "$1.$2") // Türkçe ondalık virgül
    .trim();
  try {
    const d: unknown = evaluate(temiz);
    return typeof d === "number" && Number.isFinite(d) ? d : null;
  } catch {
    return null;
  }
}

/**
 * Üretici sayısal kontrol verdiyse: ifade mathjs ile hesaplanır, belirtilen
 * sonuca ve doğru şıktaki değere eşit olmalı. Kontrol yoksa null (atlandı).
 */
export function sayisalKontrol(s: UretilenSoru): { gecti: boolean; neden?: string } | null {
  if (!s.sayisalKontrol) return null;
  const hesap = sayiyaCevir(s.sayisalKontrol.ifade);
  const beyan = sayiyaCevir(s.sayisalKontrol.sonuc);
  if (hesap === null || beyan === null) return null; // hesaplanamayan ifade: doğrulayıcıya bırak
  const esit = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
  if (!esit(hesap, beyan)) return { gecti: false, neden: `ifade ${hesap}, beyan edilen sonuç ${beyan}` };
  const sik = sayiyaCevir(s.siklar[s.dogru] ?? "");
  if (sik !== null && !esit(sik, hesap)) return { gecti: false, neden: `doğru şık ${sik}, hesap ${hesap}` };
  return { gecti: true };
}

// ── Mesajlar ─────────────────────────────────────────────────────────

export function uretimMesajlari(istek: UretimIstegi, prompt: PromptSurumu): SohbetMesaji[] {
  const onceki =
    istek.oncekiOzetler.length > 0
      ? `\nBu kazanımda daha önce yazılmış sorular (bunlara BENZEMESİN):\n${istek.oncekiOzetler.map((o) => `- ${o}`).join("\n")}`
      : "";
  return [
    { role: "system", content: prompt.metin },
    {
      role: "user",
      content: `Kazanım kodu: ${istek.kazanimKodu}
Kazanım: ${istek.kazanimAciklama}
Ders: ${istek.dersAd} (kod: ${istek.dersKodu}), ${istek.sinifDuzeyi}. sınıf düzeyi
Sınav: ${istek.sinav} (${sikSayisi(istek.sinav)} şık)
Hedef zorluk: ${istek.hedefZorluk}/10
Soru tipi: ${istek.soruTipi}
Doğru şık harfi: ${istek.dogruSik}${onceki}`,
    },
  ];
}

export function dogrulamaMesajlari(s: UretilenSoru, istek: UretimIstegi, prompt: PromptSurumu): SohbetMesaji[] {
  const siklar = SIKLAR.filter((h) => s.siklar[h] !== undefined)
    .map((h) => `${h}) ${s.siklar[h]}`)
    .join("\n");
  return [
    { role: "system", content: prompt.metin },
    {
      role: "user",
      content: `Kazanım: ${istek.kazanimKodu} — ${istek.kazanimAciklama}
Ders: ${istek.dersAd}, ${istek.sinifDuzeyi}. sınıf, ${istek.sinav}

Soru:
${s.govdeMd}

${siklar}`,
    },
  ];
}

/**
 * Çıktı token sınırında kesilmişse (JSON kapanmamış) karar alanlarını tek tek
 * okur. Karar alanlarından biri eksikse null döner (soru reddedilir).
 */
function kismiDogrulama(icerik: string): Record<string, unknown> | null {
  const cevap = /"cevap"\s*:\s*"([A-Ea-e])"/.exec(icerik)?.[1];
  const tek = /"tek_dogru_mu"\s*:\s*(true|false)/.exec(icerik)?.[1];
  const kapsam = /"kazanim_uygun"\s*:\s*(true|false)/.exec(icerik)?.[1];
  const sorunlar = /"sorunlar"\s*:\s*(\[[^\]]*\])/.exec(icerik)?.[1];
  if (!cevap || !tek || !kapsam || !sorunlar) return null;
  let liste: unknown = [];
  try {
    liste = JSON.parse(sorunlar);
  } catch {
    return null;
  }
  const z = /"zorluk_tahmini"\s*:\s*(\d+)/.exec(icerik)?.[1];
  return { cevap, tek_dogru_mu: tek === "true", kazanim_uygun: kapsam === "true", sorunlar: liste, zorluk_tahmini: z ? Number(z) : null };
}

export function dogrulamaCiktisiniCoz(icerik: string): DogrulamaSonucu {
  let v: unknown;
  try {
    v = jsonAyikla(icerik);
  } catch (h) {
    v = kismiDogrulama(icerik);
    if (!v) throw h;
  }
  if (!nesne(v)) throw new Error("doğrulama çıktısı nesne değil");
  const cevap = typeof v.cevap === "string" ? v.cevap.trim().toUpperCase().slice(0, 1) : "";
  const z = Number(v.zorluk_tahmini);
  return {
    cevap: sikMi(cevap) ? cevap : null,
    tekDogruMu: v.tek_dogru_mu !== false,
    kazanimUygun: v.kazanim_uygun !== false,
    sorunlar: Array.isArray(v.sorunlar) ? v.sorunlar.filter(metinMi) : [],
    zorlukTahmini: Number.isFinite(z) && z >= 1 && z <= 10 ? Math.round(z) : null,
  };
}

// ── Hat ──────────────────────────────────────────────────────────────

export interface HatBagimliliklari {
  istemci: KmyaiIstemci;
  uretimAyari: GorevAyari;
  dogrulamaAyari: GorevAyari;
  uretimPromptu: PromptSurumu;
  dogrulamaPromptu: PromptSurumu;
  simdi?: () => number;
}

export async function soruUret(b: HatBagimliliklari, istek: UretimIstegi): Promise<HatSonucu> {
  const simdi = b.simdi ?? Date.now;
  const bas = simdi();
  const baglam = { dershaneId: null, kullaniciId: null };
  const red = (
    asama: Extract<HatSonucu, { durum: "reddedildi" }>["asama"],
    redNedeni: string,
    soru: UretilenSoru | null,
    uretimModeli: string | null,
    dogrulayiciModeli: string | null = null,
  ): HatSonucu => ({ durum: "reddedildi", asama, redNedeni, soru, uretimModeli, dogrulayiciModeli, sureMs: simdi() - bas });

  let uretim;
  try {
    uretim = await b.istemci.tamamla({
      gorev: "soru_uretim",
      ayar: b.uretimAyari,
      mesajlar: uretimMesajlari(istek, b.uretimPromptu),
      jsonBekleniyor: true,
      promptSurumu: b.uretimPromptu.surum,
      baglam,
    });
  } catch (h) {
    return red("uretim", h instanceof Error ? h.message : "üretim başarısız", null, null);
  }

  let soru: UretilenSoru;
  try {
    soru = uretilenSoruyuCoz(uretim.icerik, istek);
  } catch (h) {
    return red("bicim", `biçim: ${h instanceof Error ? h.message : "çözümlenemedi"}`, null, uretim.model);
  }

  const kalite = kaliteKontrolu(soru, istek);
  if (kalite.length > 0) return red("kalite", kalite.join("; "), soru, uretim.model);

  const sayisal = sayisalKontrol(soru);
  if (sayisal && !sayisal.gecti) return red("sayisal", `sayısal: ${sayisal.neden ?? ""}`, soru, uretim.model);

  let dogrulamaYaniti;
  try {
    dogrulamaYaniti = await b.istemci.tamamla({
      gorev: "soru_dogrulama",
      ayar: b.dogrulamaAyari,
      mesajlar: dogrulamaMesajlari(soru, istek, b.dogrulamaPromptu),
      jsonBekleniyor: true,
      promptSurumu: b.dogrulamaPromptu.surum,
      baglam,
    });
  } catch (h) {
    return red("dogrulama", `doğrulayıcıya ulaşılamadı: ${h instanceof Error ? h.message : ""}`, soru, uretim.model);
  }

  let d: DogrulamaSonucu;
  try {
    d = dogrulamaCiktisiniCoz(dogrulamaYaniti.icerik);
  } catch {
    return red("dogrulama", `doğrulama çıktısı çözümlenemedi: ${dogrulamaYaniti.icerik.slice(0, 160)}`, soru, uretim.model, dogrulamaYaniti.model);
  }
  if (d.cevap !== soru.dogru) {
    return red("dogrulama", `doğrulayıcı ${d.cevap ?? "?"} buldu, anahtar ${soru.dogru}`, soru, uretim.model, dogrulamaYaniti.model);
  }
  if (!d.tekDogruMu) return red("dogrulama", "birden çok doğru şık", soru, uretim.model, dogrulamaYaniti.model);
  if (!d.kazanimUygun) return red("dogrulama", "kazanım dışı", soru, uretim.model, dogrulamaYaniti.model);
  if (d.sorunlar.length > 0) return red("dogrulama", `doğrulayıcı: ${d.sorunlar.join("; ").slice(0, 400)}`, soru, uretim.model, dogrulamaYaniti.model);

  return {
    durum: "dogrulandi",
    soru,
    dogrulama: d,
    uretimModeli: uretim.model,
    dogrulayiciModeli: dogrulamaYaniti.model,
    sureMs: simdi() - bas,
  };
}

/** Doğru şık harfini dengeli dağıtmak için: en az kullanılan harflerden rastgele biri. */
export function dogruSikSec(sinav: SinavTuru, harfSayaclari: Partial<Record<Sik, number>>, rastgele: () => number = Math.random): Sik {
  const harfler = SIKLAR.slice(0, sikSayisi(sinav));
  const enAz = Math.min(...harfler.map((h) => harfSayaclari[h] ?? 0));
  const adaylar = harfler.filter((h) => (harfSayaclari[h] ?? 0) === enAz);
  return adaylar[Math.floor(rastgele() * adaylar.length)] ?? harfler[0] ?? "A";
}

/** Soru tipi seçimi: kazanımın ağırlıkları varsa ona göre, yoksa zorluğa göre. */
export function soruTipiSec(zorluk: number, agirliklar: Partial<Record<SoruTipi, number>>, rastgele: () => number = Math.random): SoruTipi {
  const girdiler = Object.entries(agirliklar).filter(([k, v]) => (SORU_TIPLERI as readonly string[]).includes(k) && typeof v === "number" && v > 0) as Array<[SoruTipi, number]>;
  const tablo: Array<[SoruTipi, number]> =
    girdiler.length > 0 ? girdiler : zorluk >= 7 ? [["yeni_nesil", 3], ["yorum", 1], ["islem", 1]] : zorluk >= 4 ? [["islem", 2], ["yorum", 1], ["yeni_nesil", 1]] : [["islem", 3], ["yorum", 1]];
  const toplam = tablo.reduce((t, [, v]) => t + v, 0);
  let r = rastgele() * toplam;
  for (const [tip, v] of tablo) {
    r -= v;
    if (r < 0) return tip;
  }
  return tablo[0]?.[0] ?? "islem";
}
