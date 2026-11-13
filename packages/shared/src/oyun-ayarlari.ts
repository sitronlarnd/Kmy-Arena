/**
 * Oyun ekonomisi ve kuralların TEK kaynağı.
 *
 * Bu değerler varsayılandır. Merkez Panel > Oyun ekonomisi ekranında yapılan
 * değişiklikler `oyun_ayari_surumu` tablosunda sürümlü tutulur ve çalışma
 * anında `ayarlariBirlestir` ile bu varsayılanların üstüne yazılır.
 */

import type { Ozellik } from "./tipler";

export const OYUN_AYARLARI = {
  beceri: {
    baslangicTheta: 1000,
    /** d = tabanPuan + adim × (zorluk − 1) */
    zorlukTabanPuan: 800,
    zorlukAdim: 130,
    /** K faktörü kademeleri: [şu kadar sorudan az çözmüşse, K] */
    kKademeleri: [
      [20, 40],
      [200, 24],
    ] as ReadonlyArray<readonly [number, number]>,
    kSon: 16,
    /** Boş cevabın S değeri */
    bosS: 0.2,
    /** Tahmini sürenin bu oranından hızlı cevaplar beceriyi etkilemez */
    rastgeleCevapOrani: 0.15,
    hedefBasari: 0.7,
    meydanOkumaBasari: 0.45,
    guvenBasari: 0.85,
    /** Kalibrasyon için gereken en az cevap sayısı */
    kalibrasyonMinCevap: 20,
  },
  ustalik: {
    bronz: { theta: 1000, minSoru: 5 },
    gumus: { theta: 1250, minSoru: 10 },
    altin: { theta: 1500, son10MinDogru: 8 },
  },
  xp: {
    tabanCarpan: 10,
    hizCarpaniMax: 1.3,
    seriCarpaniMax: 1.5,
    seriAdim: 0.1,
    ipucuCarpanlari: [1, 0.8, 0.6, 0.4] as readonly number[],
    /** E bu değerin üstündeyse soru öğrenci için "çok kolay" sayılır */
    uygunsuzEsik: 0.95,
    uygunsuzCarpan: 0.2,
  },
  altin: {
    dogruCevap: 2,
    gunlukGorev: 30,
    duelloSeriBonus: 50,
    seriDondurucuFiyat: 200,
    seriDondurucuMax: 2,
  },
  tekrar: {
    /** Hata defterindeki soru bu günler sonra yeniden sorulur; doğruysa sonraki aralığa geçer */
    araliklarGun: [1, 3, 7, 21] as readonly number[],
  },
  tespit: {
    /** Ders başına uyarlamalı tespit sınavı soru sayısı (şartname: 8-12) */
    soruSayisi: 10,
    /** Bilgi en yüksek E ≈ 0,5'te: tespit soruları buna göre seçilir */
    hedefBasari: 0.5,
    /** Tespit θ'su için büyük ve azalan K: hızlı yakınsama */
    kBaslangic: 160,
    kAzalma: 0.8,
    kMin: 40,
  },
  antrenman: {
    /** Hızlı antrenman oturumu */
    soruSayisi: 10,
    /** Sunucuda ölçülen süre ile istemcinin bildirdiği süre arasında kabul edilen fark */
    sureToleransMs: 2000,
  },
  seri: {
    gunlukHedefSoru: 10,
    rozetGunleri: [7, 30, 100] as readonly number[],
  },
  karakter: {
    evrimSeviyeleri: [10, 25, 50] as readonly number[],
    /** Ders kodu → besleyen özellik */
    dersOzellik: {
      matematik: "zeka",
      geometri: "zeka",
      fizik: "enerji",
      kimya: "enerji",
      biyoloji: "enerji",
      fen: "enerji",
      turkce: "bilgelik",
      edebiyat: "bilgelik",
      tarih: "strateji",
      cografya: "strateji",
      inkilap: "strateji",
      felsefe: "strateji",
      din: "strateji",
      ingilizce: "ceviklik",
    } as Readonly<Record<string, Ozellik>>,
  },
  lig: {
    sezonHafta: 6,
    grupMin: 20,
    grupMax: 30,
    yukselen: 5,
    dusen: 5,
  },
  duello: {
    soruSayisi: 5,
    kazanmaPuani: 3,
    geriSayimSn: 3,
    turArasiSn: 5,
    sureMinSn: 20,
    sureMaxSn: 120,
    gecikmeDuzeltmeMaxMs: 250,
    yenidenBaglanmaSn: 15,
    kupaK: 32,
    eslesmeAraliklari: [
      { saniye: 0, fark: 150 },
      { saniye: 10, fark: 300 },
      { saniye: 20, fark: Number.POSITIVE_INFINITY },
    ] as ReadonlyArray<{ saniye: number; fark: number }>,
    robotOneriSn: 25,
    asenkronSureSaat: 24,
    hedefBasari: 0.6,
    supheliHizMs: 3000,
  },
  klan: {
    kurmaMinSeviye: 5,
    kurmaMinSoru7Gun: 50,
    uyeMin: 5,
    uyeMax: 30,
    yardimciMax: 3,
    liderPasifGun: 14,
    savasSaldiriHakki: 30,
    savasMinUye: 5,
    savasKupa: 30,
    katilimCarpanlari: [
      { altSinir: 1, carpan: 1.3 },
      { altSinir: 0.8, carpan: 1.2 },
      { altSinir: 0.5, carpan: 1 },
      { altSinir: 0, carpan: 0.8 },
    ] as ReadonlyArray<{ altSinir: number; carpan: number }>,
  },
  topluluk: {
    gunlukSoruSiniri: 5,
    gunlukXpSiniri: 300,
    ilkKabulXp: 50,
    ilkKabulAltin: 20,
    sonrakiKabulXp: 20,
    aiIpucuDk: 15,
    aiCozumDk: 120,
  },
  sinirlar: {
    gunlukAsistanMesaj: 40,
    gunlukFotografCoz: 15,
    gunlukBildirim: 2,
    saatlikDuelloDaveti: 3,
    sessizBaslangic: "22:30",
    sessizBitis: "07:30",
    gecDereceliKapanis: "23:30",
    molaOnerisiDk: 45,
  },
  sinav: {
    /** Bir doğruyu götüren yanlış sayısı */
    yanlisGoturu: { LGS: 3, TYT: 4, AYT: 4, YDT: 4 },
  },
} as const;

/** `as const` sabit değerlerini genişletir; panelden gelen farklı değerler tipe uyar. */
type Genislet<T> = T extends number
  ? number
  : T extends string
    ? string
    : T extends boolean
      ? boolean
      : T extends readonly unknown[]
        ? { readonly [I in keyof T]: Genislet<T[I]> }
        : T extends object
          ? { readonly [K in keyof T]: Genislet<T[K]> }
          : T;

export type OyunAyarlari = Genislet<typeof OYUN_AYARLARI>;

type DerinKismi<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DerinKismi<T[K]> : T[K];
};

function nesneMi(d: unknown): d is Record<string, unknown> {
  return typeof d === "object" && d !== null && !Array.isArray(d);
}

/**
 * Varsayılan ayarların üstüne panelden gelen kısmi ayarları derinlemesine yazar.
 * Diziler bütün olarak değiştirilir. Bilinmeyen anahtarlar yok sayılır.
 */
export function ayarlariBirlestir(
  varsayilan: OyunAyarlari,
  kismi: DerinKismi<OyunAyarlari> | null | undefined,
): OyunAyarlari {
  const birlestir = (a: unknown, b: unknown): unknown => {
    if (!nesneMi(a) || !nesneMi(b)) return b === undefined ? a : b;
    const sonuc: Record<string, unknown> = { ...a };
    for (const anahtar of Object.keys(a)) {
      if (anahtar in b) sonuc[anahtar] = birlestir(a[anahtar], b[anahtar]);
    }
    return sonuc;
  };
  return birlestir(varsayilan, kismi ?? {}) as OyunAyarlari;
}
