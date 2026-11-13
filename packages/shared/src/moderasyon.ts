/**
 * Kullanıcı üretimli metin filtresi (klan adı/sloganı, serbest sohbet, takma ad,
 * topluluk). Sunucuda çalışır; istemci yalnızca ön uyarı için kullanabilir.
 *
 * - Küfür/hakaret: Türkçe karakterler ve "leet" yazım (0→o, 1→i, @→a …) normalize
 *   edilir, harf tekrarları sıkıştırılır; kısa kökler yalnız tam kelime olarak,
 *   ayırt edici uzun kökler kelime içinde de aranır ("sıkıntı" gibi masum kelimeler
 *   takılmaz).
 * - Kişisel bilgi: telefon, e-posta, uzun rakam dizisi, sosyal medya kullanıcı adı.
 * - Bağlantı: http(s), www., alan adı.
 */

export type ModerasyonSebebi = "kufur" | "kisisel_bilgi" | "baglanti";
export interface ModerasyonSonucu {
  temiz: boolean;
  sebep: ModerasyonSebebi | null;
}

const HARF: Record<string, string> = {
  ı: "i", İ: "i", ş: "s", ğ: "g", ü: "u", ö: "o", ç: "c", â: "a", î: "i", û: "u",
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i",
};

/** Küçük harf, Türkçe → ASCII, leet → harf, tekrarlar sıkıştırılmış. */
export function normallestir(metin: string): string {
  return metin
    .toLocaleLowerCase("tr-TR")
    .split("")
    .map((c) => HARF[c] ?? c)
    .join("")
    .replace(/(.)\1+/g, "$1");
}

// Yalnız tam kelime olarak yasak (kısa, başka kelimelerin içinde geçebilen kökler)
const TAM_KELIME = new Set([
  "amk", "aq", "amq", "sik", "sikik", "sikerim", "siker", "got", "gotu", "oc", "pic", "pici",
  "salak", "aptal", "ibne", "gavat", "yavsak", "pust", "kaltak", "surtuk", "dangalak", "ezik", "lavuk",
  "fuck", "shit", "bitch", "dick", "ass",
]);
// Kelime içinde de yasak (ayırt edici kökler)
const KOK = [
  "siktir", "sikeyim", "sikiyim", "orospu", "orspu", "yarak", "yarrak", "yarag", "amcik", "amina", "aminako", "anani",
  "kahpe", "pezeven", "gerizekal", "serefsiz", "haysiyetsiz", "puşt", "pusttur", "godos", "kevase", "yosma",
  "motherf", "fucking",
];

const BAGLANTI = /(https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(com|net|org|tr|io|me|gg|ly|app|link|xyz|info)\b)/i;
const EPOSTA = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const TELEFON = /(\+?\s*9\s*0[\s.-]*)?\(?0?\s*5\d{2}\)?[\s.-]*\d{3}[\s.-]*\d{2}[\s.-]*\d{2}/;
const UZUN_RAKAM = /\d[\d\s.-]{8,}\d/;
const KULLANICI_ADI = /(^|\s)@[a-z0-9_.]{3,}/i;
const SOSYAL = /\b(insta(gram)?|snap(chat)?|tiktok|telegram|whats?app|discord|twitter|numaram|adresim|ev adresim|facebook|face)\b/i;

export function metniDenetle(metin: string): ModerasyonSonucu {
  const ham = metin.trim();
  if (EPOSTA.test(ham) || TELEFON.test(ham) || UZUN_RAKAM.test(ham) || KULLANICI_ADI.test(ham) || SOSYAL.test(ham)) {
    return { temiz: false, sebep: "kisisel_bilgi" };
  }
  if (BAGLANTI.test(ham)) return { temiz: false, sebep: "baglanti" };
  const n = normallestir(ham);
  const kelimeler = n.split(/[^a-z]+/).filter(Boolean);
  if (kelimeler.some((k) => TAM_KELIME.has(k))) return { temiz: false, sebep: "kufur" };
  const kokler = KOK.map(normallestir);
  if (kelimeler.some((w) => kokler.some((k) => w.includes(k)))) return { temiz: false, sebep: "kufur" };
  // Harfleri ayrı yazılmış uzun kökler ("s i k t i r"): yalnız tek harfli parçalar birleştirilir
  const tekHarfler = kelimeler.filter((w) => w.length === 1).join("");
  if (tekHarfler.length >= 5 && kokler.some((k) => k.length >= 5 && tekHarfler.includes(k))) return { temiz: false, sebep: "kufur" };
  return { temiz: true, sebep: null };
}

/**
 * Kendine zarar / ciddi sıkıntı ifadeleri (asistan ve topluluk). Eşleşirse AI'ye
 * gönderilmez; öğrenciye destek mesajı gösterilir ve rehberlik servisine kısa
 * bir bildirim düşer. Yanlış pozitif, yanlış negatiften iyidir.
 */
const DESTEK_IFADELERI = [
  "intihar", "kendimi oldur", "kendimi oldurecegim", "olmek istiyorum", "yasamak istemiyorum", "yasamak istemiyom",
  "kendime zarar", "kendimi kes", "bilegimi kes", "bileklerimi", "canima kiy", "her seye son ver", "hayatima son",
  "kimse beni sevmiyor", "dayanamiyorum artik", "beni dovuyor", "bana dokunuyor", "taciz",
];
export function destekGerekli(metin: string): boolean {
  const n = normallestir(metin).replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ");
  return DESTEK_IFADELERI.some((i) => n.includes(normallestir(i)));
}
