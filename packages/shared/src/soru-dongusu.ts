/**
 * Bir cevabın tüm sonuçlarını (beceri, XP, Altın, ustalık, tespit) hesaplayan
 * saf fonksiyonlar. API bu sonucu veritabanına tek işlemde yazar; istemci
 * hiçbir değeri kendisi hesaplayıp göndermez.
 */

import { beklenenBasari, thetaGuncelle, ustalikHesapla, xpHesapla, zorluktanPuana, hedefZorluk, puandanZorluga, hedefPuan } from "./formuller";
import { OYUN_AYARLARI, type OyunAyarlari } from "./oyun-ayarlari";
import { sinirla, type CevapSonucu, type Ustalik } from "./tipler";

export interface CevapDurumu {
  /** Kazanımdaki mevcut beceri (yoksa başlangıç) */
  theta: number;
  cozulen: number;
  son10: readonly number[];
  /** Sorunun kullanılacak zorluğu (ölçülmüş varsa o) */
  zorluk: number;
  tahminiSureSn: number;
  /** Bu cevaptan ÖNCE art arda doğru sayısı */
  seriOnce: number;
  ipucuSayisi: number;
  sonuc: CevapSonucu;
  sureMs: number;
}

export interface CevapHesabi {
  thetaSonra: number;
  sayildi: boolean;
  beklenen: number;
  xp: number;
  altin: number;
  ustalik: Ustalik;
}

export function cevapHesapla(d: CevapDurumu, a: OyunAyarlari = OYUN_AYARLARI): CevapHesabi {
  const tahminiMs = d.tahminiSureSn * 1000;
  const beceri = thetaGuncelle(
    { theta: d.theta, cozulen: d.cozulen, d: zorluktanPuana(d.zorluk, a), sonuc: d.sonuc, sureMs: d.sureMs, tahminiSureMs: tahminiMs },
    a,
  );
  const dogru = d.sonuc === "dogru";
  // Çok hızlı (rastgele) doğru cevap ödül de kazandırmaz.
  const odul = dogru && beceri.sayildi;
  const xp = odul
    ? xpHesapla({ zorluk: d.zorluk, sureMs: d.sureMs, tahminiSureMs: tahminiMs, seri: d.seriOnce + 1, ipucuSayisi: d.ipucuSayisi, beklenen: beceri.beklenen }, a)
    : 0;
  const son10 = [...d.son10, dogru ? 1 : 0].slice(-10);
  const ustalik = ustalikHesapla(
    { theta: beceri.theta, cozulen: d.cozulen + (beceri.sayildi ? 1 : 0), son10Dogru: son10.reduce((t, x) => t + x, 0) },
    a,
  );
  return {
    thetaSonra: Math.round(beceri.theta * 100) / 100,
    sayildi: beceri.sayildi,
    beklenen: Math.round(beceri.beklenen * 1000) / 1000,
    xp,
    altin: odul ? a.altin.dogruCevap : 0,
    ustalik,
  };
}

// ── Seviye tespiti ──────────────────────────────────────────────────

/** Tespit sınavında n. sorudan sonra θ güncellemesi (büyük, azalan K). */
export function tespitThetaGuncelle(
  g: { theta: number; cevaplanan: number; zorluk: number; sonuc: CevapSonucu },
  a: OyunAyarlari = OYUN_AYARLARI,
): number {
  const t = a.tespit;
  const k = Math.max(t.kMin, t.kBaslangic * t.kAzalma ** g.cevaplanan);
  const s = g.sonuc === "dogru" ? 1 : g.sonuc === "bos" ? a.beceri.bosS : 0;
  const e = beklenenBasari(g.theta, zorluktanPuana(g.zorluk, a));
  return Math.round(sinirla(g.theta + k * (s - e), 400, 2400) * 100) / 100;
}

/** Tespit sorusunun zorluğu: E ≈ 0,5 (en bilgilendirici). */
export function tespitZorlugu(theta: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  return Math.round(puandanZorluga(hedefPuan(theta, a.tespit.hedefBasari), a));
}

/** Tespitte sıradaki kazanım: dersin kazanımlarına eşit aralıkla yayılır. */
export function tespitKazanimSirasi(cevaplanan: number, kazanimSayisi: number, soruSayisi: number): number {
  if (kazanimSayisi <= 0) return 0;
  if (kazanimSayisi <= soruSayisi) return cevaplanan % kazanimSayisi;
  return Math.min(kazanimSayisi - 1, Math.floor((cevaplanan * kazanimSayisi) / soruSayisi));
}

// ── Antrenman akışı ─────────────────────────────────────────────────

/** Normal akışta istenen zorluk (akış sırasına göre 0,70 / 0,45 / 0,85 hedefi). */
export function antrenmanZorlugu(theta: number, akisSirasi: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  return hedefZorluk(theta, akisSirasi, a);
}

/**
 * Süre hilesine karşı: istemcinin bildirdiği süre, sunucunun ölçtüğü süreden
 * (gösterim → cevap) tolerans kadarından fazla kısa veya uzun olamaz.
 */
export function guvenilirSure(istemciMs: number, sunucuMs: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  const tol = a.antrenman.sureToleransMs;
  if (!Number.isFinite(istemciMs) || istemciMs < 0) return Math.max(0, sunucuMs);
  return Math.round(sinirla(istemciMs, Math.max(0, sunucuMs - tol), sunucuMs + tol));
}
