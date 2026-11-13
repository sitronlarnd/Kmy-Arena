import type { OZELLIKLER } from "./tipler";

type OzellikKodu = (typeof OZELLIKLER)[number];

export type BolgeKodu = "mat" | "fen" | "turkce" | "sosyal" | "ingilizce";
export const BOLGELER: ReadonlyArray<{ kod: BolgeKodu; ad: string; emoji: string; ozellik: OzellikKodu }> = [
  { kod: "mat", ad: "Matematik Kalesi", emoji: "🏰", ozellik: "zeka" },
  { kod: "fen", ad: "Fen Laboratuvarı", emoji: "⚗️", ozellik: "enerji" },
  { kod: "turkce", ad: "Türkçe Kütüphanesi", emoji: "📜", ozellik: "bilgelik" },
  { kod: "sosyal", ad: "Sosyal Vadisi", emoji: "🗺️", ozellik: "strateji" },
  { kod: "ingilizce", ad: "İngilizce Limanı", emoji: "⚓", ozellik: "ceviklik" },
];

/** Klan seviyesi: toplam katkı 100 → 2, 400 → 3, 900 → 4 … (en fazla 20) — SQL app.klan_seviyesi ile aynı. */
export function klanSeviyesi(katki: number): number {
  return Math.min(20, 1 + Math.floor(Math.sqrt(Math.max(0, katki) / 100)));
}
export function klanSeviyeEsigi(seviye: number): number {
  return (seviye - 1) ** 2 * 100;
}

/** Özellik puanı → seviye (1-10); boss hasarı = zorluk × seviye. */
export function ozellikSeviyesi(puan: number): number {
  return Math.min(10, 1 + Math.floor(Math.sqrt(Math.max(0, puan) / 10)));
}

// ── Amblem: hazır parçalar; bazıları klan seviyesiyle açılır ──
export const AMBLEM_KALKANLARI = [
  { kod: "klasik", ad: "Klasik", seviye: 1 },
  { kod: "yuvarlak", ad: "Yuvarlak", seviye: 1 },
  { kod: "sivri", ad: "Sivri", seviye: 1 },
  { kod: "kanatli", ad: "Kanatlı", seviye: 3 },
  { kod: "tacli", ad: "Taçlı", seviye: 5 },
  { kod: "yildizli", ad: "Yıldızlı", seviye: 8 },
] as const;
export const AMBLEM_SIMGELERI = [
  { kod: "yildiz", emoji: "⭐", seviye: 1 },
  { kod: "simsek", emoji: "⚡", seviye: 1 },
  { kod: "kitap", emoji: "📘", seviye: 1 },
  { kod: "ates", emoji: "🔥", seviye: 1 },
  { kod: "dag", emoji: "⛰️", seviye: 1 },
  { kod: "kurt", emoji: "🐺", seviye: 3 },
  { kod: "kartal", emoji: "🦅", seviye: 3 },
  { kod: "ejder", emoji: "🐉", seviye: 5 },
  { kod: "tac", emoji: "👑", seviye: 8 },
  { kod: "elmas", emoji: "💎", seviye: 10 },
] as const;
export const AMBLEM_RENKLERI = ["#2E86AB", "#E4572E", "#17BEBB", "#76B041", "#FFC914", "#8E44AD", "#34495E", "#D35400"] as const;

export interface Amblem {
  kalkan: string;
  simge: string;
  renk: string;
}

export function amblemGecerli(a: Partial<Amblem> | null | undefined, klanSeviye = 1): a is Amblem {
  if (!a) return false;
  const k = AMBLEM_KALKANLARI.find((x) => x.kod === a.kalkan);
  const s = AMBLEM_SIMGELERI.find((x) => x.kod === a.simge);
  return Boolean(k && s && k.seviye <= klanSeviye && s.seviye <= klanSeviye && AMBLEM_RENKLERI.includes(a.renk as (typeof AMBLEM_RENKLERI)[number]));
}

export function amblemSimgesi(kod: string | undefined): string {
  return AMBLEM_SIMGELERI.find((x) => x.kod === kod)?.emoji ?? "⭐";
}

/** Klan unvanı (seviyeye göre) */
export function klanUnvani(seviye: number): string {
  if (seviye >= 15) return "Efsane Klan";
  if (seviye >= 10) return "Usta Klan";
  if (seviye >= 5) return "Yükselen Klan";
  if (seviye >= 3) return "Kararlı Klan";
  return "Çaylak Klan";
}

// ── Sohbet: varsayılan yalnız hazır mesajlar ──
export const KLAN_HAZIR_MESAJLAR = [
  { kod: "selam", metin: "Selam klan! 👋" },
  { kod: "hadi", metin: "Hadi bugün 30 soru! 💪" },
  { kod: "boss", metin: "Boss'a saldıralım! 🐉" },
  { kod: "savas", metin: "Savaş başladı, haklarımızı kullanalım! ⚔️" },
  { kod: "hedef", metin: "Haftalık hedefe az kaldı! 🎯" },
  { kod: "tebrik", metin: "Tebrikler! 🎉" },
  { kod: "harika", metin: "Harika gidiyoruz! 🔥" },
  { kod: "yardim", metin: "Bu konuda yardım lazım 🙋" },
  { kod: "tesekkur", metin: "Teşekkürler! 🙏" },
  { kod: "iyigeceler", metin: "İyi geceler, yarın devam 🌙" },
] as const;
export type HazirMesajKodu = (typeof KLAN_HAZIR_MESAJLAR)[number]["kod"];
export function hazirMesaj(kod: string | null | undefined): string | null {
  return KLAN_HAZIR_MESAJLAR.find((m) => m.kod === kod)?.metin ?? null;
}

export const SIKAYET_SEBEPLERI = ["kufur", "zorbalik", "kisisel_bilgi", "spam", "uygunsuz", "diger"] as const;
export type SikayetSebebi = (typeof SIKAYET_SEBEPLERI)[number];
