/**
 * Soru havuzu politikası (karar #1).
 *
 * - AI sürekli soru üretir; doğrulanmış her soru havuza girer ve FARKLI
 *   öğrencilere tekrar sunulur.
 * - Aynı öğrenci aynı soruyu asla iki kez görmez (veritabanında
 *   soru_gosterim(kullanici_id, soru_id) birincil anahtarı ile garanti).
 * - Düelloda yalnızca taze / az kullanılmış sorular kullanılır.
 * - Zorluk, 20+ gerçek cevapla yeniden kalibre edilir (formuller.olculmusZorluk).
 * - Yeni üretim yalnızca havuz bir öğrenciye/banda yetmediğinde tetiklenir.
 *
 * Asıl seçim sorgusu Postgres'te çalışır; bu modül aynı kuralların saf
 * TypeScript karşılığıdır (test ve panel simülasyonları için).
 */

import { sinirla, type SoruDurumu } from "./tipler";

export const HAVUZ_AYARLARI = {
  /** Zorluk bandı genişliği: 1-2, 3-4, 5-6, 7-8, 9-10 → 5 bant */
  bantGenisligi: 2,
  /** Düello için "taze" sayılan en fazla gösterim sayısı */
  duelloMaxGosterim: 3,
  /** Bir soru en fazla bu kadar düelloda kullanılır */
  duelloMaxKullanim: 1,
  /** Bu kadar gösterimden sonra soru emekliye ayrılır (sızma riski) */
  emeklilikGosterim: 400,
  /** Bir öğrenci için (kazanım, bant) başına görülmemiş soru alt sınırı */
  ogrenciMinStok: 5,
  /** Düello için (kazanım, bant) başına taze soru alt sınırı */
  duelloMinTaze: 4,
  /** Hata bildirimi oranı bu eşiği geçerse soru incelemeye düşer */
  hataOraniEsigi: 0.05,
} as const;

export interface HavuzSorusu {
  id: string;
  kazanimId: string;
  zorluk: number;
  durum: SoruDurumu;
  gosterimSayisi: number;
  duelloKullanim: number;
}

export function zorlukBandi(zorluk: number): number {
  return Math.ceil(sinirla(Math.round(zorluk), 1, 10) / HAVUZ_AYARLARI.bantGenisligi);
}

export function sunulabilirMi(s: HavuzSorusu): boolean {
  return s.durum === "dogrulandi" && s.gosterimSayisi < HAVUZ_AYARLARI.emeklilikGosterim;
}

export function duelloyaUygunMu(s: HavuzSorusu): boolean {
  return (
    sunulabilirMi(s) &&
    s.gosterimSayisi <= HAVUZ_AYARLARI.duelloMaxGosterim &&
    s.duelloKullanim < HAVUZ_AYARLARI.duelloMaxKullanim
  );
}

/**
 * Antrenman için soru seçer. Öğrencinin görmediği, doğrulanmış sorulardan
 * önce DAHA ÖNCE KULLANILMIŞ olanları tercih eder; böylece taze sorular
 * düelloya saklanır ve her üretim maliyeti olabildiğince çok öğrenciye yayılır.
 * `rastgele` enjekte edilebilir (test için).
 */
export function antrenmanSorusuSec(
  adaylar: readonly HavuzSorusu[],
  gorulenler: ReadonlySet<string>,
  rastgele: () => number = Math.random,
): HavuzSorusu | null {
  const uygun = adaylar.filter((s) => sunulabilirMi(s) && !gorulenler.has(s.id));
  if (uygun.length === 0) return null;
  const kullanilmis = uygun.filter((s) => !duelloyaUygunMu(s));
  const grup = kullanilmis.length > 0 ? kullanilmis : uygun;
  return grup[Math.floor(rastgele() * grup.length)] ?? null;
}

export function duelloSorusuSec(
  adaylar: readonly HavuzSorusu[],
  oyuncularinGordukleri: ReadonlySet<string>,
  rastgele: () => number = Math.random,
): HavuzSorusu | null {
  const uygun = adaylar.filter((s) => duelloyaUygunMu(s) && !oyuncularinGordukleri.has(s.id));
  if (uygun.length === 0) return null;
  const enAz = Math.min(...uygun.map((s) => s.gosterimSayisi));
  const enTaze = uygun.filter((s) => s.gosterimSayisi === enAz);
  return enTaze[Math.floor(rastgele() * enTaze.length)] ?? null;
}

/** Bir (kazanım, bant) için kaç yeni soru üretilmeli? 0 → üretim yok. */
export function uretimIhtiyaci(g: { ogrenciIcinGorulmemis: number; tazeDuelloStok: number }): number {
  const a = HAVUZ_AYARLARI;
  return Math.max(0, a.ogrenciMinStok - g.ogrenciIcinGorulmemis, a.duelloMinTaze - g.tazeDuelloStok);
}
