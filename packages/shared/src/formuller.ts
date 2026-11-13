/**
 * Puan, beceri ve ödül formülleri. Hepsi saf fonksiyondur ve yalnızca
 * sunucuda (API / Postgres fonksiyonları) sonuç üretmek için kullanılır;
 * istemci bunları sadece önizleme amaçlı gösterebilir.
 */

import { OYUN_AYARLARI, type OyunAyarlari } from "./oyun-ayarlari";
import { sinirla, type CevapSonucu, type SinavTuru, type Ustalik } from "./tipler";

// ── Elo tabanlı beceri ─────────────────────────────────────────────

/** Zorluk (1-10) → puan: d = 800 + 130 × (zorluk − 1) */
export function zorluktanPuana(zorluk: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  return a.beceri.zorlukTabanPuan + a.beceri.zorlukAdim * (zorluk - 1);
}

/** Puan → zorluk (1-10 aralığına sıkıştırılmış, ondalıklı). */
export function puandanZorluga(d: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  return sinirla(1 + (d - a.beceri.zorlukTabanPuan) / a.beceri.zorlukAdim, 1, 10);
}

/** E = 1 / (1 + 10^((d − θ)/400)) */
export function beklenenBasari(theta: number, d: number): number {
  return 1 / (1 + 10 ** ((d - theta) / 400));
}

export function kFaktoru(cozulenSoru: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  for (const [ust, k] of a.beceri.kKademeleri) {
    if (cozulenSoru < ust) return k;
  }
  return a.beceri.kSon;
}

export function sonucDegeri(sonuc: CevapSonucu, a: OyunAyarlari = OYUN_AYARLARI): number {
  if (sonuc === "dogru") return 1;
  if (sonuc === "bos") return a.beceri.bosS;
  return 0;
}

export interface BeceriGirdisi {
  theta: number;
  /** Bu kazanımda daha önce çözülen soru sayısı */
  cozulen: number;
  /** Sorunun puan karşılığı (d) */
  d: number;
  sonuc: CevapSonucu;
  sureMs: number;
  tahminiSureMs: number;
}

export interface BeceriSonucu {
  theta: number;
  /** false ise cevap çok hızlıydı (rastgele) ve beceriyi etkilemedi */
  sayildi: boolean;
  beklenen: number;
}

/** θ_yeni = θ + K (S − E). Çok hızlı rastgele cevaplar sayılmaz. */
export function thetaGuncelle(g: BeceriGirdisi, a: OyunAyarlari = OYUN_AYARLARI): BeceriSonucu {
  const e = beklenenBasari(g.theta, g.d);
  const rastgele = g.sonuc !== "bos" && g.sureMs < g.tahminiSureMs * a.beceri.rastgeleCevapOrani;
  if (rastgele) return { theta: g.theta, sayildi: false, beklenen: e };
  const k = kFaktoru(g.cozulen, a);
  return { theta: g.theta + k * (sonucDegeri(g.sonuc, a) - e), sayildi: true, beklenen: e };
}

/** Beklenen başarının hedef değerde (ör. 0,70) olacağı soru puanı. */
export function hedefPuan(theta: number, hedefE: number): number {
  const e = sinirla(hedefE, 0.01, 0.99);
  return theta + 400 * Math.log10(1 / e - 1);
}

/**
 * Akıştaki sıraya göre hedef başarı: her 5 soruda bir meydan okuma (≈0,45)
 * ve bir güven (≈0,85) sorusu; geri kalanı ≈0,70.
 */
export function siradakiHedefBasari(akisSirasi: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  const konum = ((akisSirasi % 5) + 5) % 5;
  if (konum === 2) return a.beceri.meydanOkumaBasari;
  if (konum === 4) return a.beceri.guvenBasari;
  return a.beceri.hedefBasari;
}

/** Öğrencinin θ'sına ve akış sırasına göre istenen zorluk (1-10, tam sayı). */
export function hedefZorluk(theta: number, akisSirasi: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  const d = hedefPuan(theta, siradakiHedefBasari(akisSirasi, a));
  return Math.round(puandanZorluga(d, a));
}

// ── Soru zorluğunun gerçek istatistikle kalibrasyonu ──────────────

export interface KalibrasyonCevabi {
  /** Cevap anındaki öğrenci θ'sı */
  theta: number;
  sonuc: CevapSonucu;
}

export interface KalibrasyonSonucu {
  d: number;
  zorluk: number;
  cevapSayisi: number;
}

/**
 * Yeterli cevap (varsayılan 20+) toplanmış bir sorunun ölçülmüş zorluğu.
 * Σ E_i(d) = Σ S_i eşitliğini sağlayan d ikiye bölme ile bulunur
 * (Rasch/Elo en çok olabilirlik tahmininin tek parametreli hâli).
 * Yetersiz veri varsa null döner.
 */
export function olculmusZorluk(
  cevaplar: readonly KalibrasyonCevabi[],
  a: OyunAyarlari = OYUN_AYARLARI,
): KalibrasyonSonucu | null {
  if (cevaplar.length < a.beceri.kalibrasyonMinCevap) return null;
  const toplamS = cevaplar.reduce((t, c) => t + sonucDegeri(c.sonuc, a), 0);
  const fark = (d: number): number => cevaplar.reduce((t, c) => t + beklenenBasari(c.theta, d), 0) - toplamS;
  let alt = 0;
  let ust = 3000;
  // E, d arttıkça azalır: fark(alt) > 0 > fark(ust) aranır.
  for (let i = 0; i < 60; i++) {
    const orta = (alt + ust) / 2;
    if (fark(orta) > 0) alt = orta;
    else ust = orta;
  }
  const d = (alt + ust) / 2;
  return { d, zorluk: Math.round(puandanZorluga(d, a) * 10) / 10, cevapSayisi: cevaplar.length };
}

// ── Ustalık ─────────────────────────────────────────────────────────

export function ustalikHesapla(
  g: { theta: number; cozulen: number; son10Dogru: number },
  a: OyunAyarlari = OYUN_AYARLARI,
): Ustalik {
  const u = a.ustalik;
  if (g.theta >= u.altin.theta && g.cozulen >= 10 && g.son10Dogru >= u.altin.son10MinDogru) return "altin";
  if (g.theta >= u.gumus.theta && g.cozulen >= u.gumus.minSoru) return "gumus";
  if (g.theta >= u.bronz.theta && g.cozulen >= u.bronz.minSoru) return "bronz";
  return "kesfedilmedi";
}

// ── XP ──────────────────────────────────────────────────────────────

export interface XpGirdisi {
  zorluk: number;
  sureMs: number;
  tahminiSureMs: number;
  /** Bu cevap dahil art arda doğru sayısı */
  seri: number;
  ipucuSayisi: number;
  /** Öğrencinin bu soru için beklenen başarısı */
  beklenen: number;
}

/** XP = 10 × zorluk × hız × seri × ipucu × uygunluk (yalnızca doğru cevapta). */
export function xpHesapla(g: XpGirdisi, a: OyunAyarlari = OYUN_AYARLARI): number {
  const x = a.xp;
  const hizOrani = g.tahminiSureMs > 0 ? 1 - g.sureMs / g.tahminiSureMs : 0;
  const hiz = sinirla(1 + (x.hizCarpaniMax - 1) * hizOrani, 1, x.hizCarpaniMax);
  const seri = sinirla(1 + x.seriAdim * Math.max(0, g.seri - 1), 1, x.seriCarpaniMax);
  const ipucu = x.ipucuCarpanlari[Math.min(g.ipucuSayisi, x.ipucuCarpanlari.length - 1)] ?? 1;
  const uygunluk = g.beklenen > x.uygunsuzEsik ? x.uygunsuzCarpan : 1;
  return Math.round(x.tabanCarpan * g.zorluk * hiz * seri * ipucu * uygunluk);
}

/** Karakter seviyesi için gereken toplam XP (yumuşak artan eğri). */
export function seviyeIcinXp(seviye: number): number {
  if (seviye <= 1) return 0;
  return Math.round(100 * (seviye - 1) ** 1.6);
}

export function xpdenSeviye(toplamXp: number): number {
  let seviye = 1;
  while (seviyeIcinXp(seviye + 1) <= toplamXp) seviye++;
  return seviye;
}

// ── Sınav, düello, klan ─────────────────────────────────────────────

/** Net = doğru − yanlış / götürü (LGS 3, YKS 4). */
export function netHesapla(dogru: number, yanlis: number, sinav: SinavTuru, a: OyunAyarlari = OYUN_AYARLARI): number {
  return Math.round((dogru - yanlis / a.sinav.yanlisGoturu[sinav]) * 100) / 100;
}

/** Dereceli düello Kupa değişimi (Elo, K = 32). A'nın kazancı döner. */
export function kupaDegisimi(kupaA: number, kupaB: number, aKazandi: boolean, a: OyunAyarlari = OYUN_AYARLARI): number {
  const e = beklenenBasari(kupaA, kupaB);
  return Math.round(a.duello.kupaK * ((aKazandi ? 1 : 0) - e));
}

/** Adil cevap zamanı: sunucu alış anı − min(RTT/2, 250 ms). */
export function adilCevapZamani(sunucuAlisMs: number, rttMs: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  return sunucuAlisMs - Math.min(Math.max(0, rttMs) / 2, a.duello.gecikmeDuzeltmeMaxMs);
}

export function duelloTurSuresiSn(tahminiSureSn: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  return sinirla(Math.round(tahminiSureSn), a.duello.sureMinSn, a.duello.sureMaxSn);
}

/** Klan savaşında bir doğru cevabın etkisi = 10 × (1 + (1 − E)). */
export function klanSavasEtkisi(beklenen: number): number {
  return 10 * (1 + (1 - sinirla(beklenen, 0, 1)));
}

export function katilimCarpani(katilimOrani: number, a: OyunAyarlari = OYUN_AYARLARI): number {
  for (const k of a.klan.katilimCarpanlari) {
    if (katilimOrani >= k.altSinir) return k.carpan;
  }
  return 1;
}
