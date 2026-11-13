/** API ile istemciler arasındaki sözleşme (apps/api ↔ apps/mobile). */

import type { CevapSonucu, Sik, SinavTuru, SoruTipi, Ustalik } from "./tipler";

export type SoruModu = "antrenman" | "tekrar" | "tespit";

export interface SiradakiIstegi {
  mod: SoruModu;
  /** Antrenman: belirli kazanım (yoksa ders veya genel akış) */
  kazanimKodu?: string;
  dersKodu?: string;
  /** Tespit: hangi ders */
  tespitDersKodu?: string;
}

/** Öğrenciye giden soru: cevap anahtarı, çözüm ve çeldirici notları YOK. */
export interface IstemciSorusu {
  id: string;
  kazanimKodu: string;
  kazanim: string;
  ders: string;
  sinav: SinavTuru;
  tip: SoruTipi;
  zorluk: number;
  tahminiSureSn: number;
  govdeMd: string;
  siklar: Partial<Record<Sik, string>>;
  ipucuSayisi: number;
  ipucuVar: boolean;
  aiUretimi: boolean;
}

export type SiradakiYaniti =
  | { durum: "soru"; mod: SoruModu; soru: IstemciSorusu; tespit?: { cevaplanan: number; toplam: number } }
  /** Havuz boş: arka planda üretim başladı, birkaç saniye sonra yeniden dene */
  | { durum: "hazirlaniyor"; tekrarDeneMs: number }
  | { durum: "tekrar_yok" }
  | { durum: "tespit_bitti" }
  | { durum: "yedek_mod"; mesaj: string };

export interface CevapIstegi {
  soruId: string;
  /** null = boş bırakıldı */
  secilen: Sik | null;
  sureMs: number;
}

export interface CevapYaniti {
  sonuc: CevapSonucu;
  dogru: Sik;
  cozumAdimlari: string[];
  /** Öğrencinin seçtiği yanlış şık için çeldirici notu */
  celdiriciNotu: string | null;
  xp: number;
  altin: number;
  xpToplam: number;
  altinToplam: number;
  seviye: number;
  seviyeAtladi: boolean;
  seri: number;
  thetaOnce: number;
  thetaSonra: number;
  ustalik: Ustalik;
  /** Rastgele (çok hızlı) cevap beceriyi etkilemedi */
  sayilmadi: boolean;
  hataDefteri: "eklendi" | "ilerledi" | "temizlendi" | "basa_dondu" | null;
  tespitBitti: boolean;
}

export interface IpucuYaniti {
  ipucu: string;
  sira: number;
  kalan: number;
}

export interface HataYaniti {
  hata: string;
}
