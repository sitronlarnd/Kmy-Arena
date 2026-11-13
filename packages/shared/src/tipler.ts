/** Platform genelinde kullanılan temel tipler. */

export const SINAV_TURLERI = ["LGS", "TYT", "AYT", "YDT"] as const;
export type SinavTuru = (typeof SINAV_TURLERI)[number];

export const SIKLAR = ["A", "B", "C", "D", "E"] as const;
export type Sik = (typeof SIKLAR)[number];

/** LGS 4 şık (A-D), YKS 5 şık (A-E). */
export function sikSayisi(sinav: SinavTuru): 4 | 5 {
  return sinav === "LGS" ? 4 : 5;
}

export type CevapSonucu = "dogru" | "yanlis" | "bos";

export const CEVAP_BAGLAMLARI = [
  "antrenman",
  "tespit",
  "duello",
  "klan",
  "odev",
  "deneme",
  "topluluk",
  "canli",
  "tekrar",
] as const;
export type CevapBaglami = (typeof CEVAP_BAGLAMLARI)[number];

export const OZELLIKLER = ["zeka", "enerji", "bilgelik", "strateji", "ceviklik"] as const;
export type Ozellik = (typeof OZELLIKLER)[number];

export type Ustalik = "kesfedilmedi" | "bronz" | "gumus" | "altin";

export const SORU_TIPLERI = [
  "islem",
  "yorum",
  "paragraf",
  "grafik_okuma",
  "yeni_nesil",
] as const;
export type SoruTipi = (typeof SORU_TIPLERI)[number];

/** Soru havuzundaki bir sorunun yaşam döngüsü. */
export type SoruDurumu = "uretildi" | "dogrulandi" | "reddedildi" | "emekli";

export type SoruKaynagi = "ai" | "ogretmen";

/** Bir değeri [min, max] aralığına sıkıştırır. */
export function sinirla(deger: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, deger));
}
