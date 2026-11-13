/**
 * AI görevleri ve model ayarlarının çözümlenmesi.
 *
 * Öncelik: dershane > paket > genel (Merkez Panel, `ai_gorev_ayari` tablosu)
 *          > ortam değişkenleri > koddaki varsayılan.
 * Model adları kodda sabit DEĞİLDİR; ortam değişkeninden ve Merkez Panelden
 * değiştirilebilir. Üretici ve doğrulayıcı farklı model aileleridir (karar #4, 2026-11-13).
 */

export const AI_GOREVLERI = [
  "soru_uretim",
  "soru_dogrulama",
  "asistan",
  "gorsel_okuma",
  "topluluk_degerlendirme",
  "moderasyon",
  "veli_raporu",
  "ogretmen_soru_uretim",
] as const;
export type AiGorevi = (typeof AI_GOREVLERI)[number];

export interface GorevAyari {
  modelBirincil: string;
  modelYedek: string;
  sicaklik: number;
  maxToken: number;
  zamanAsimiMs: number;
  yenidenDeneme: number;
}

export type OrtamDegiskenleri = Readonly<Record<string, string | undefined>>;

const VARSAYILAN_MODELLER = {
  uretici: "gemini-3.6-flash",
  dogrulayici: "claude-haiku-5-5",
  ogretmen: "claude-sonnet-5-5",
  asistan: "claude-sonnet-5-5",
  gorsel: "claude-sonnet-5-5",
  veliRaporu: "claude-sonnet-5-5",
  yedek: "claude-haiku-4-5",
} as const;

function sayi(deger: string | undefined, varsayilan: number): number {
  const n = Number(deger);
  return deger !== undefined && deger !== "" && Number.isFinite(n) ? n : varsayilan;
}

function metin(deger: string | undefined, varsayilan: string): string {
  return deger !== undefined && deger.trim() !== "" ? deger.trim() : varsayilan;
}

/** Ortam değişkenlerinden her görev için başlangıç ayarları. */
export function ortamdanVarsayilanlar(env: OrtamDegiskenleri): Record<AiGorevi, GorevAyari> {
  const m = {
    uretici: metin(env.KMYAI_MODEL_URETICI, VARSAYILAN_MODELLER.uretici),
    dogrulayici: metin(env.KMYAI_MODEL_DOGRULAYICI, VARSAYILAN_MODELLER.dogrulayici),
    ogretmen: metin(env.KMYAI_MODEL_OGRETMEN, VARSAYILAN_MODELLER.ogretmen),
    asistan: metin(env.KMYAI_MODEL_ASISTAN, VARSAYILAN_MODELLER.asistan),
    gorsel: metin(env.KMYAI_MODEL_GORSEL, VARSAYILAN_MODELLER.gorsel),
    veliRaporu: metin(env.KMYAI_MODEL_VELI_RAPORU, VARSAYILAN_MODELLER.veliRaporu),
    yedek: metin(env.KMYAI_MODEL_YEDEK, VARSAYILAN_MODELLER.yedek),
  };
  // Soru üretimi arka planda (havuz) çalışır; uzun çıktılı modeller 20 sn'ye sığmaz.
  const uretimMs = sayi(env.KMYAI_ZAMAN_ASIMI_URETIM_MS, 90_000);
  const asistanMs = sayi(env.KMYAI_ZAMAN_ASIMI_ASISTAN_MS, 30_000);
  const deneme = sayi(env.KMYAI_YENIDEN_DENEME, 2);
  const ayar = (model: string, sicaklik: number, maxToken: number, zamanAsimiMs: number): GorevAyari => ({
    modelBirincil: model, modelYedek: m.yedek, sicaklik, maxToken, zamanAsimiMs, yenidenDeneme: deneme,
  });
  return {
    soru_uretim: { ...ayar(m.uretici, 0.8, 4000, uretimMs), modelYedek: m.dogrulayici, yenidenDeneme: Math.min(deneme, 1) },
    // Doğrulayıcı da yedeğe düşerse doğrulama gücü azalır; yedek olarak
    // yine güçlü model kalır, haiku'ya düşülmez.
    // Doğrulayıcıya ulaşılamazsa daha zayıf bir modele düşülmez: soru atılır, sonra yeniden üretilir.
    soru_dogrulama: { ...ayar(m.dogrulayici, 0, 2500, uretimMs), modelYedek: "", yenidenDeneme: Math.min(deneme, 1) },
    asistan: ayar(m.asistan, 0.4, 900, asistanMs),
    gorsel_okuma: ayar(m.gorsel, 0, 1500, asistanMs),
    topluluk_degerlendirme: ayar(m.yedek, 0, 400, 20_000),
    moderasyon: ayar(m.yedek, 0, 200, 20_000),
    veli_raporu: ayar(m.veliRaporu, 0.5, 600, asistanMs),
    ogretmen_soru_uretim: ayar(m.ogretmen, 0.7, 4000, uretimMs),
  };
}

/** Merkez Panel kayıtlarından gelen kısmi geçersiz kılmalar. */
export interface AyarKatmanlari {
  genel?: Partial<GorevAyari> | null;
  paket?: Partial<GorevAyari> | null;
  dershane?: Partial<GorevAyari> | null;
}

function tanimliOlanlar(k: Partial<GorevAyari> | null | undefined): Partial<GorevAyari> {
  if (!k) return {};
  return Object.fromEntries(Object.entries(k).filter(([, v]) => v !== undefined && v !== null)) as Partial<GorevAyari>;
}

export function gorevAyariCoz(taban: GorevAyari, katmanlar: AyarKatmanlari = {}): GorevAyari {
  return {
    ...taban,
    ...tanimliOlanlar(katmanlar.genel),
    ...tanimliOlanlar(katmanlar.paket),
    ...tanimliOlanlar(katmanlar.dershane),
  };
}
