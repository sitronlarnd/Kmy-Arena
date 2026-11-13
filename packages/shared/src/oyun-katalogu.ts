/**
 * Oyun kataloğu — karakterler, lig kademeleri, mağaza eşyaları, rozetler ve
 * görev şablonları. TEK kaynak: API ödül verirken, uygulama gösterirken bunu
 * kullanır. Veritabanı yalnızca kodları saklar (envanter, kullanici_rozet,
 * kullanici_gorev). Ekonomi değerleri (fiyat, ödül) Merkez Panel > Oyun
 * ekonomisi ile değiştirilebilir hâle Faz 6'da gelir.
 *
 * İlkeler (şartname §6, §14): Altın asla gerçek parayla satılmaz; mağaza
 * yalnızca kozmetik + seri dondurucu; rastgele ödüllü sandık yok; karakterler
 * eşit güçte, yalnızca görünüş farklı; telifli karakter/marka yok.
 */

import type { Ozellik, Ustalik } from "./tipler";

// ── Karakterler ─────────────────────────────────────────────────────

export const KARAKTERLER = [
  { tur: "bilge_baykus", ad: "Bilge Baykuş", emoji: "🦉", renk: "#7C5CFA", aciklama: "Sakin, dikkatli, her ayrıntıyı görür." },
  { tur: "kivilcim_tilki", ad: "Kıvılcım Tilki", emoji: "🦊", renk: "#F2711C", aciklama: "Hızlı düşünür, pratik çözümler bulur." },
  { tur: "demir_ayi", ad: "Demir Ayı", emoji: "🐻", renk: "#8D6E63", aciklama: "Pes etmez, zor sorulara dayanır." },
  { tur: "ruzgar_atmacasi", ad: "Rüzgâr Atmacası", emoji: "🦅", renk: "#2BA3C4", aciklama: "Hedefe kilitlenir, yükseklerden bakar." },
  { tur: "golge_kedi", ad: "Gölge Kedi", emoji: "🐈‍⬛", renk: "#455A64", aciklama: "Sessiz çalışır, beklenmedik anda parlar." },
  { tur: "tas_kaplumbaga", ad: "Taş Kaplumbağa", emoji: "🐢", renk: "#3E9B5A", aciklama: "Yavaş ama emin adımlarla ilerler." },
] as const;
export type KarakterTuru = (typeof KARAKTERLER)[number]["tur"];

export function karakterBul(tur: string | null | undefined) {
  return KARAKTERLER.find((k) => k.tur === tur) ?? null;
}

/** Evrim: seviye 10, 25, 50'de görünüm değişir (0-3). */
export function evrimAsamasi(seviye: number, esikler: readonly number[] = [10, 25, 50]): number {
  return esikler.filter((e) => seviye >= e).length;
}

export const EVRIM_ADLARI = ["Çırak", "Kaşif", "Usta", "Efsane"] as const;

/** "Çok Yönlü": 5 özelliğin hepsi bu eşiği geçince. */
export const COK_YONLU_ESIK = 50;

export const OZELLIK_ETKILERI: Record<Ozellik, string> = {
  zeka: "Klan boss savaşında vurduğun hasar",
  enerji: "Günlük bonus soru hakkı",
  bilgelik: "Düelloda aura ve unvanlar",
  strateji: "Klan savaşında bölge savunma gücü",
  ceviklik: "Profil animasyonları ve unvanlar",
};

// ── Lig ─────────────────────────────────────────────────────────────

export const LIG_KADEMELERI = [
  { ad: "Bronz", renk: "#B87333" },
  { ad: "Gümüş", renk: "#8E9AAF" },
  { ad: "Altın", renk: "#D4A017" },
  { ad: "Platin", renk: "#3BB4A8" },
  { ad: "Elmas", renk: "#4F8EF7" },
  { ad: "Efsane", renk: "#B44FE8" },
] as const;

/** Lig adımı 1-18 → "Bronz III" … "Efsane I". */
export function ligAdimi(adim: number): { kademe: number; alt: number; ad: string; renk: string } {
  const a = Math.min(18, Math.max(1, Math.round(adim)));
  const kademe = Math.floor((a - 1) / 3) + 1;
  const alt = 3 - ((a - 1) % 3);
  const k = LIG_KADEMELERI[kademe - 1] ?? LIG_KADEMELERI[0];
  return { kademe, alt, ad: `${k.ad} ${["", "I", "II", "III"][alt]}`, renk: k.renk };
}

/** Sezon sonu kademe ödülü (Altın) — veritabanındaki sistem_lig_kapat ile aynı. */
export const SEZON_ODULU_ALTIN = [50, 100, 200, 300, 400, 600] as const;

// ── Mağaza ──────────────────────────────────────────────────────────

export type EsyaTuru = "kostum" | "cerceve" | "arka_plan" | "duello_efekti" | "seri_dondurucu";

export interface Esya {
  kod: string;
  ad: string;
  tur: EsyaTuru;
  fiyat: number;
  /** Görsel: renk (çerçeve/arka plan) veya emoji (kostüm aksesuarı) */
  renk?: string;
  emoji?: string;
  /** Satın almak için en az seviye */
  minSeviye?: number;
  /** Satılmaz; rozetle kazanılır */
  rozetle?: string;
}

export const ESYALAR: readonly Esya[] = [
  { kod: "seri_dondurucu", ad: "Seri dondurucu", tur: "seri_dondurucu", fiyat: 200, emoji: "🧊" },
  // Kostüm aksesuarları (her karaktere uyar)
  { kod: "kostum_atki", ad: "Kış atkısı", tur: "kostum", fiyat: 150, emoji: "🧣" },
  { kod: "kostum_gozluk", ad: "Okuma gözlüğü", tur: "kostum", fiyat: 150, emoji: "👓" },
  { kod: "kostum_sapka", ad: "Kaşif şapkası", tur: "kostum", fiyat: 250, emoji: "🎩", minSeviye: 5 },
  { kod: "kostum_kask", ad: "Bisiklet kaskı", tur: "kostum", fiyat: 250, emoji: "⛑️", minSeviye: 5 },
  { kod: "kostum_tac", ad: "Bilgi tacı", tur: "kostum", fiyat: 800, emoji: "👑", minSeviye: 20 },
  { kod: "kostum_pelerin", ad: "Çok Yönlü pelerini", tur: "kostum", fiyat: 0, emoji: "🦸", rozetle: "cok_yonlu" },
  // Çerçeveler
  { kod: "cerceve_mor", ad: "Mor çerçeve", tur: "cerceve", fiyat: 100, renk: "#7C5CFA" },
  { kod: "cerceve_turuncu", ad: "Turuncu çerçeve", tur: "cerceve", fiyat: 100, renk: "#F2711C" },
  { kod: "cerceve_yesil", ad: "Yeşil çerçeve", tur: "cerceve", fiyat: 100, renk: "#3E9B5A" },
  { kod: "cerceve_altin", ad: "Altın çerçeve", tur: "cerceve", fiyat: 300, renk: "#D4A017", minSeviye: 10 },
  { kod: "cerceve_elmas", ad: "Elmas çerçeve", tur: "cerceve", fiyat: 600, renk: "#4F8EF7", minSeviye: 25 },
  // Avatar arka planları
  { kod: "arka_gece", ad: "Gece mavisi", tur: "arka_plan", fiyat: 120, renk: "#1E2A55" },
  { kod: "arka_gunbatimi", ad: "Gün batımı", tur: "arka_plan", fiyat: 120, renk: "#F6A15A" },
  { kod: "arka_orman", ad: "Orman", tur: "arka_plan", fiyat: 120, renk: "#2F6B3F" },
  { kod: "arka_galaksi", ad: "Galaksi", tur: "arka_plan", fiyat: 400, renk: "#3A1C71", minSeviye: 15 },
  // Düello efektleri (Faz 3'te düelloda görünür)
  { kod: "efekt_kivilcim", ad: "Kıvılcım izi", tur: "duello_efekti", fiyat: 200, emoji: "✨" },
  { kod: "efekt_yildirim", ad: "Yıldırım", tur: "duello_efekti", fiyat: 350, emoji: "⚡", minSeviye: 10 },
];

export function esyaBul(kod: string | null | undefined): Esya | null {
  return ESYALAR.find((e) => e.kod === kod) ?? null;
}

// ── Rozetler ────────────────────────────────────────────────────────

/** API'nin sistem_oyun_metrikleri'nden okuduğu değerler. */
export interface OyunMetrikleri {
  toplam_cevap: number;
  toplam_dogru: number;
  seviye: number;
  seri_gun: number;
  en_uzun_seri: number;
  max_ardisik: number;
  sabah_cozum: number;
  zor_dogru: number;
  ipucusuz_dogru: number;
  temizlenen_hata: number;
  gorev_tamamlanan: number;
  haftalik_gorev_tamamlanan: number;
  lig_yukselme: number;
  en_iyi_lig_adim: number;
  ozellik_min: number;
  bronz_ustu: number;
  gumus_ustu: number;
  altin: number;
  acik_hata: number;
  tespit_biten: number;
  ders_sayisi: number;
  tam_set: boolean;
  envanter: number;
  duello_galibiyet?: number;
  en_uzun_duello_seri?: number;
}

export type RozetKategorisi = "soru" | "seri" | "ustalik" | "tekrar" | "beceri" | "gorev" | "karakter" | "lig" | "sosyal";

export interface Rozet {
  kod: string;
  ad: string;
  aciklama: string;
  kategori: RozetKategorisi;
  altin: number;
  emoji: string;
  /** Kazanılınca seçilebilen unvan */
  unvan?: string;
  /** Koşul: metrik ≥ eşik. Yoksa bu rozet sonraki bir fazda açılır. */
  kosul?: { metrik: keyof OyunMetrikleri; esik: number } | ((m: OyunMetrikleri) => boolean);
  /** Açılacağı faz (koşul yoksa) */
  faz?: number;
}

const k = (metrik: keyof OyunMetrikleri, esik: number) => ({ metrik, esik });

export const ROZETLER: readonly Rozet[] = [
  // Soru (8)
  { kod: "ilk_soru", ad: "İlk adım", aciklama: "İlk sorunu çöz.", kategori: "soru", altin: 20, emoji: "👣", kosul: k("toplam_cevap", 1) },
  { kod: "soru_100", ad: "Yüzler kulübü", aciklama: "100 soru çöz.", kategori: "soru", altin: 50, emoji: "💯", kosul: k("toplam_cevap", 100) },
  { kod: "soru_500", ad: "Azimli", aciklama: "500 soru çöz.", kategori: "soru", altin: 100, emoji: "📚", kosul: k("toplam_cevap", 500) },
  { kod: "soru_1000", ad: "Binler kulübü", aciklama: "1000 soru çöz.", kategori: "soru", altin: 200, emoji: "🏛️", unvan: "Soru Avcısı", kosul: k("toplam_cevap", 1000) },
  { kod: "soru_5000", ad: "Maratoncu", aciklama: "5000 soru çöz.", kategori: "soru", altin: 500, emoji: "🏃", unvan: "Maratoncu", kosul: k("toplam_cevap", 5000) },
  { kod: "dogru_50", ad: "İsabetli", aciklama: "50 doğru cevap ver.", kategori: "soru", altin: 40, emoji: "🎯", kosul: k("toplam_dogru", 50) },
  { kod: "dogru_250", ad: "Keskin nişancı", aciklama: "250 doğru cevap ver.", kategori: "soru", altin: 100, emoji: "🏹", kosul: k("toplam_dogru", 250) },
  { kod: "dogru_1000", ad: "Şaşmaz", aciklama: "1000 doğru cevap ver.", kategori: "soru", altin: 250, emoji: "🧭", unvan: "Şaşmaz", kosul: k("toplam_dogru", 1000) },
  // Seri (4)
  { kod: "seri_3", ad: "Isınma turu", aciklama: "3 gün üst üste günlük hedefini tamamla.", kategori: "seri", altin: 30, emoji: "🔥", kosul: k("en_uzun_seri", 3) },
  { kod: "seri_7", ad: "Bir hafta", aciklama: "7 günlük seri yap.", kategori: "seri", altin: 70, emoji: "📅", kosul: k("en_uzun_seri", 7) },
  { kod: "seri_30", ad: "Bir ay", aciklama: "30 günlük seri yap.", kategori: "seri", altin: 300, emoji: "🗓️", unvan: "Disiplinli", kosul: k("en_uzun_seri", 30) },
  { kod: "seri_100", ad: "Yüz gün", aciklama: "100 günlük seri yap.", kategori: "seri", altin: 1000, emoji: "🌋", unvan: "Durdurulamaz", kosul: k("en_uzun_seri", 100) },
  // Ustalık (6)
  { kod: "ilk_bronz", ad: "İlk durak", aciklama: "Bir kazanımı Bronz yap.", kategori: "ustalik", altin: 30, emoji: "🥉", kosul: k("bronz_ustu", 1) },
  { kod: "ilk_gumus", ad: "Parlayan", aciklama: "Bir kazanımı Gümüş yap.", kategori: "ustalik", altin: 50, emoji: "🥈", kosul: k("gumus_ustu", 1) },
  { kod: "ilk_altin", ad: "Konu fatihi", aciklama: "Bir kazanımı Altın yap.", kategori: "ustalik", altin: 100, emoji: "🥇", kosul: k("altin", 1) },
  { kod: "altin_5", ad: "Beş fetih", aciklama: "5 kazanımı Altın yap.", kategori: "ustalik", altin: 200, emoji: "🏆", kosul: k("altin", 5) },
  { kod: "altin_25", ad: "Fatih", aciklama: "25 kazanımı Altın yap.", kategori: "ustalik", altin: 500, emoji: "👑", unvan: "Fatih", kosul: k("altin", 25) },
  { kod: "tam_set", ad: "Tam set", aciklama: "Bir dersin tüm kazanım kartlarını topla (en az Bronz).", kategori: "ustalik", altin: 500, emoji: "🃏", unvan: "Koleksiyoncu", kosul: (m) => m.tam_set },
  // Tekrar (3)
  { kod: "hata_temiz_1", ad: "Hatadan ders", aciklama: "Hata defterinden bir soruyu temizle.", kategori: "tekrar", altin: 30, emoji: "🧽", kosul: k("temizlenen_hata", 1) },
  { kod: "hata_temiz_25", ad: "Temiz sayfa", aciklama: "Hata defterinden 25 soru temizle.", kategori: "tekrar", altin: 150, emoji: "📓", kosul: k("temizlenen_hata", 25) },
  { kod: "hata_sifir", ad: "Sıfır hata", aciklama: "En az 10 soru temizledikten sonra hata defterini tamamen boşalt.", kategori: "tekrar", altin: 200, emoji: "✅", unvan: "Titiz", kosul: (m) => m.temizlenen_hata >= 10 && m.acik_hata === 0 },
  // Beceri (5)
  { kod: "zor_10", ad: "Zorlu tırmanış", aciklama: "Zorluğu 8 ve üstü 10 soruyu doğru çöz.", kategori: "beceri", altin: 150, emoji: "🧗", kosul: k("zor_dogru", 10) },
  { kod: "ardisik_10", ad: "On numara", aciklama: "Üst üste 10 doğru cevap ver.", kategori: "beceri", altin: 80, emoji: "🔟", kosul: k("max_ardisik", 10) },
  { kod: "ardisik_25", ad: "Kusursuz akış", aciklama: "Üst üste 25 doğru cevap ver.", kategori: "beceri", altin: 250, emoji: "🌊", unvan: "Akışta", kosul: k("max_ardisik", 25) },
  { kod: "ipucusuz_50", ad: "Kendi başıma", aciklama: "İpucu kullanmadan 50 doğru cevap ver.", kategori: "beceri", altin: 80, emoji: "🧠", kosul: k("ipucusuz_dogru", 50) },
  { kod: "sabah_kusu", ad: "Sabah kuşu", aciklama: "Sabah 07.00-09.00 arasında 20 soru çöz.", kategori: "beceri", altin: 60, emoji: "🌅", unvan: "Sabah Kuşu", kosul: k("sabah_cozum", 20) },
  // Seviye ve karakter (6)
  { kod: "seviye_10", ad: "Kaşif", aciklama: "Seviye 10'a ulaş (karakterin ilk evrimi).", kategori: "karakter", altin: 100, emoji: "🌱", kosul: k("seviye", 10) },
  { kod: "seviye_25", ad: "Usta", aciklama: "Seviye 25'e ulaş.", kategori: "karakter", altin: 250, emoji: "🌳", kosul: k("seviye", 25) },
  { kod: "seviye_50", ad: "Efsane", aciklama: "Seviye 50'ye ulaş.", kategori: "karakter", altin: 600, emoji: "🌟", unvan: "Efsane", kosul: k("seviye", 50) },
  { kod: "cok_yonlu", ad: "Çok Yönlü", aciklama: `Beş özelliğin hepsini ${COK_YONLU_ESIK} puana çıkar. Ödül: Çok Yönlü pelerini.`, kategori: "karakter", altin: 300, emoji: "🦸", unvan: "Çok Yönlü", kosul: k("ozellik_min", COK_YONLU_ESIK) },
  { kod: "ilk_alisveris", ad: "Tarz sahibi", aciklama: "Mağazadan ilk kozmetiğini al.", kategori: "karakter", altin: 0, emoji: "🛍️", kosul: k("envanter", 1) },
  { kod: "koleksiyon_10", ad: "Gardırop", aciklama: "10 kozmetik topla.", kategori: "karakter", altin: 100, emoji: "🧥", kosul: k("envanter", 10) },
  // Görev ve tespit (5)
  { kod: "gorev_10", ad: "Görev adamı", aciklama: "10 günlük görev tamamla.", kategori: "gorev", altin: 60, emoji: "📋", kosul: k("gorev_tamamlanan", 10) },
  { kod: "gorev_50", ad: "Görev ustası", aciklama: "50 günlük görev tamamla.", kategori: "gorev", altin: 200, emoji: "🗂️", kosul: k("gorev_tamamlanan", 50) },
  { kod: "haftalik_5", ad: "Haftanın yıldızı", aciklama: "5 haftalık görev tamamla.", kategori: "gorev", altin: 150, emoji: "⭐", kosul: k("haftalik_gorev_tamamlanan", 5) },
  { kod: "tespit_ilk", ad: "Kendini tanı", aciklama: "İlk seviye tespitini tamamla.", kategori: "gorev", altin: 40, emoji: "🔍", kosul: k("tespit_biten", 1) },
  { kod: "tespit_hepsi", ad: "Tam harita", aciklama: "Tüm derslerinde seviye tespitini tamamla.", kategori: "gorev", altin: 150, emoji: "🗺️", kosul: (m) => m.ders_sayisi > 0 && m.tespit_biten >= m.ders_sayisi },
  // Lig (3)
  { kod: "lig_yukselme", ad: "Yükselişte", aciklama: "Haftalık ligde bir üst kademeye çık.", kategori: "lig", altin: 50, emoji: "📈", kosul: k("lig_yukselme", 1) },
  { kod: "lig_altin", ad: "Altın lig", aciklama: "Altın ligine ulaş.", kategori: "lig", altin: 200, emoji: "🏅", kosul: k("en_iyi_lig_adim", 7) },
  { kod: "lig_efsane", ad: "Efsaneler arasında", aciklama: "Efsane ligine ulaş.", kategori: "lig", altin: 800, emoji: "💎", unvan: "Efsane Ligci", kosul: k("en_iyi_lig_adim", 16) },
  // Sosyal (sonraki fazlarda açılır) (6)
  { kod: "duello_ilk", ad: "İlk zafer", aciklama: "İlk düellonu kazan.", kategori: "sosyal", altin: 50, emoji: "⚔️", kosul: k("duello_galibiyet", 1) },
  { kod: "duello_seri_10", ad: "Yenilmez", aciklama: "Üst üste 10 düello kazan.", kategori: "sosyal", altin: 300, emoji: "🛡️", unvan: "Yenilmez", kosul: k("en_uzun_duello_seri", 10) },
  { kod: "klan_katil", ad: "Takım oyuncusu", aciklama: "Bir klana katıl.", kategori: "sosyal", altin: 30, emoji: "🤝", faz: 4 },
  { kod: "boss_vurus", ad: "Boss avcısı", aciklama: "Bir klan boss'una 100 hasar ver.", kategori: "sosyal", altin: 100, emoji: "🐉", faz: 4 },
  { kod: "topluluk_10", ad: "Yardımsever", aciklama: "Toplulukta 10 kabul edilmiş cevap ver.", kategori: "sosyal", altin: 150, emoji: "💬", unvan: "Yardımsever", faz: 5 },
  { kod: "hata_avcisi", ad: "Hata avcısı", aciklama: "Öğretmenin onayladığı bir soru hatası bildir.", kategori: "sosyal", altin: 50, emoji: "🐞", faz: 6 },
];

export function rozetKosuluSaglandi(r: Rozet, m: OyunMetrikleri): boolean {
  if (!r.kosul) return false;
  if (typeof r.kosul === "function") return r.kosul(m);
  const v = m[r.kosul.metrik];
  return Number(v ?? 0) >= r.kosul.esik;
}

/** Yeni kazanılan rozetler (sahip olunanlar hariç). */
export function yeniRozetler(m: OyunMetrikleri, sahip: ReadonlySet<string>): Rozet[] {
  return ROZETLER.filter((r) => !sahip.has(r.kod) && rozetKosuluSaglandi(r, m));
}

/** Rozet ilerlemesi (gösterim için). */
export function rozetIlerlemesi(r: Rozet, m: OyunMetrikleri): { mevcut: number; hedef: number } | null {
  if (!r.kosul || typeof r.kosul === "function") return null;
  return { mevcut: Math.min(Number(m[r.kosul.metrik] ?? 0), r.kosul.esik), hedef: r.kosul.esik };
}

// ── Görevler ────────────────────────────────────────────────────────

export type GorevOlcutu =
  | "soru"            // her cevap
  | "dogru"           // doğru cevap
  | "ardisik"         // üst üste doğru (en yüksek değer)
  | "zor_dogru"       // zorluk ≥ 5 doğru
  | "ipucusuz_dogru"
  | "kazanim"         // parametredeki kazanımdan cevap
  | "tekrar"          // hata defteri tekrarı
  | "temizle"         // hata defterinden temizlenen
  | "hedef_gun"       // günlük hedefin tamamlandığı gün
  | "ustalik"         // bir kazanımın ustalığı yükseldi
  | "gunluk_soru";    // bugünkü toplam soru (seriyi geri kazan)

export interface GorevSablonu {
  kod: string;
  tur: "gunluk" | "haftalik";
  baslik: string;
  olcut: GorevOlcutu;
  hedef: number;
  xp: number;
  altin: number;
}

export const GOREV_SABLONLARI: readonly GorevSablonu[] = [
  // Günlük (biri her zaman zayıf konu)
  { kod: "zayif_konu", tur: "gunluk", baslik: "Zayıf konun {kazanim}'dan {hedef} soru çöz", olcut: "kazanim", hedef: 5, xp: 40, altin: 30 },
  { kod: "soru_10", tur: "gunluk", baslik: "{hedef} soru çöz", olcut: "soru", hedef: 10, xp: 30, altin: 30 },
  { kod: "dogru_8", tur: "gunluk", baslik: "{hedef} doğru cevap ver", olcut: "dogru", hedef: 8, xp: 30, altin: 30 },
  { kod: "ardisik_5", tur: "gunluk", baslik: "Üst üste {hedef} doğru yap", olcut: "ardisik", hedef: 5, xp: 30, altin: 30 },
  { kod: "zor_3", tur: "gunluk", baslik: "Zorluğu 5 ve üstü {hedef} soruyu doğru çöz", olcut: "zor_dogru", hedef: 3, xp: 40, altin: 30 },
  { kod: "ipucusuz_5", tur: "gunluk", baslik: "İpucu kullanmadan {hedef} doğru yap", olcut: "ipucusuz_dogru", hedef: 5, xp: 30, altin: 30 },
  { kod: "tekrar_3", tur: "gunluk", baslik: "Hata defterinden {hedef} soruyu tekrar et", olcut: "tekrar", hedef: 3, xp: 40, altin: 30 },
  { kod: "seri_geri_kazan", tur: "gunluk", baslik: "Seriyi geri kazan: bugün {hedef} soru çöz", olcut: "gunluk_soru", hedef: 20, xp: 50, altin: 0 },
  // Haftalık
  { kod: "h_soru_100", tur: "haftalik", baslik: "Bu hafta {hedef} soru çöz", olcut: "soru", hedef: 100, xp: 150, altin: 100 },
  { kod: "h_hedef_5", tur: "haftalik", baslik: "Bu hafta {hedef} gün günlük hedefini tamamla", olcut: "hedef_gun", hedef: 5, xp: 150, altin: 100 },
  { kod: "h_ustalik_2", tur: "haftalik", baslik: "{hedef} kazanımın ustalığını yükselt", olcut: "ustalik", hedef: 2, xp: 150, altin: 100 },
  { kod: "h_temizle_5", tur: "haftalik", baslik: "Hata defterinden {hedef} soru temizle", olcut: "temizle", hedef: 5, xp: 150, altin: 100 },
];

export interface UretilenGorev {
  kod: string;
  tur: "gunluk" | "haftalik";
  baslik: string;
  hedef: number;
  parametre: Record<string, string | number>;
  xp: number;
  altin: number;
}

function sablon(kod: string): GorevSablonu {
  const s = GOREV_SABLONLARI.find((x) => x.kod === kod);
  if (!s) throw new Error(`görev şablonu yok: ${kod}`);
  return s;
}

function gorevYap(s: GorevSablonu, hedef: number, parametre: Record<string, string | number> = {}, etiket: Record<string, string> = {}): UretilenGorev {
  let baslik = s.baslik.replace("{hedef}", String(hedef));
  for (const [a, d] of Object.entries(etiket)) baslik = baslik.replace(`{${a}}`, d);
  return { kod: s.kod, tur: s.tur, baslik, hedef, parametre, xp: s.xp, altin: s.altin };
}

export interface GunlukGorevGirdisi {
  /** En zayıf (θ en düşük) kazanım; yoksa çalışılacak ilk kazanım */
  zayifKazanim: { id: string; kod: string } | null;
  vadesiGelenTekrar: number;
  /** Bugün seri kırıldıysa önceki seri uzunluğu */
  kirilanSeri: number;
  gunlukHedef: number;
}

/**
 * Günlük 3 görev: biri her zaman zayıf konu; diğer ikisi havuzdan (tekrar
 * görevi yalnızca vadesi gelen soru varsa). Seri bugün kırıldıysa 4. görev:
 * "seriyi geri kazan" (günlük hedefin 2 katı).
 */
export function gunlukGorevleriSec(g: GunlukGorevGirdisi, rastgele: () => number = Math.random): UretilenGorev[] {
  const sonuc: UretilenGorev[] = [];
  if (g.zayifKazanim) {
    sonuc.push(gorevYap(sablon("zayif_konu"), 5, { kazanimId: g.zayifKazanim.id }, { kazanim: g.zayifKazanim.kod }));
  }
  const havuz = ["soru_10", "dogru_8", "ardisik_5", "zor_3", "ipucusuz_5", ...(g.vadesiGelenTekrar >= 3 ? ["tekrar_3", "tekrar_3"] : [])];
  while (sonuc.length < 3 && havuz.length > 0) {
    const i = Math.floor(rastgele() * havuz.length);
    const kod = havuz[i] as string;
    for (let j = havuz.length - 1; j >= 0; j--) if (havuz[j] === kod) havuz.splice(j, 1);
    const s = sablon(kod);
    sonuc.push(gorevYap(s, s.hedef));
  }
  if (g.kirilanSeri >= 2) sonuc.push(gorevYap(sablon("seri_geri_kazan"), g.gunlukHedef * 2));
  return sonuc;
}

export function haftalikGorevler(): UretilenGorev[] {
  return GOREV_SABLONLARI.filter((s) => s.tur === "haftalik").map((s) => gorevYap(s, s.hedef));
}

/** Bir cevap olayının görevlere etkisi. */
export interface GorevOlayi {
  dogru: boolean;
  zorluk: number;
  kazanimId: string;
  ipucuSayisi: number;
  baglam: string;
  hataDefteri: string | null;
  ustalikOnce: Ustalik;
  ustalikSonra: Ustalik;
  /** Bu cevap dahil art arda doğru */
  ardisik: number;
  gunlukSoru: number;
  hedefTamam: boolean;
}

const USTALIK_SIRASI: Record<Ustalik, number> = { kesfedilmedi: 0, bronz: 1, gumus: 2, altin: 3 };

/** Görevin yeni ilerleme değeri; değişmiyorsa null. */
export function gorevIlerlemesi(
  gorev: { gorev_kod: string; ilerleme: number; hedef: number; parametre: Record<string, unknown> },
  olay: GorevOlayi,
): number | null {
  const s = GOREV_SABLONLARI.find((x) => x.kod === gorev.gorev_kod);
  if (!s) return null;
  const artir = (kosul: boolean) => (kosul ? gorev.ilerleme + 1 : null);
  let yeni: number | null = null;
  switch (s.olcut) {
    case "soru": yeni = gorev.ilerleme + 1; break;
    case "dogru": yeni = artir(olay.dogru); break;
    case "ardisik": yeni = olay.ardisik > gorev.ilerleme ? olay.ardisik : null; break;
    case "zor_dogru": yeni = artir(olay.dogru && olay.zorluk >= 5); break;
    case "ipucusuz_dogru": yeni = artir(olay.dogru && olay.ipucuSayisi === 0); break;
    case "kazanim": yeni = artir(gorev.parametre.kazanimId === olay.kazanimId); break;
    case "tekrar": yeni = artir(olay.baglam === "tekrar"); break;
    case "temizle": yeni = artir(olay.hataDefteri === "temizlendi"); break;
    case "hedef_gun": yeni = artir(olay.hedefTamam); break;
    case "ustalik": yeni = artir(USTALIK_SIRASI[olay.ustalikSonra] > USTALIK_SIRASI[olay.ustalikOnce]); break;
    case "gunluk_soru": yeni = olay.gunlukSoru > gorev.ilerleme ? olay.gunlukSoru : null; break;
  }
  return yeni === null ? null : Math.min(gorev.hedef, yeni);
}

// ── Seri gösterimi ──────────────────────────────────────────────────

/**
 * Ekranda görünen seri: son tamamlanan gün dün veya bugünse seri sürüyor;
 * arada kalan boş günleri dondurucular karşılıyorsa yine sürüyor; değilse 0.
 */
export function gorunenSeri(g: { seriGun: number; seriSonGun: string | null; dondurucu: number; bugun: string }): { seri: number; tehlikede: boolean } {
  if (!g.seriSonGun || g.seriGun <= 0) return { seri: 0, tehlikede: false };
  const fark = Math.round((Date.parse(g.bugun) - Date.parse(g.seriSonGun)) / 86_400_000);
  if (fark <= 0) return { seri: g.seriGun, tehlikede: false };
  if (fark === 1) return { seri: g.seriGun, tehlikede: true };
  if (fark - 1 <= g.dondurucu) return { seri: g.seriGun, tehlikede: true };
  return { seri: 0, tehlikede: false };
}
