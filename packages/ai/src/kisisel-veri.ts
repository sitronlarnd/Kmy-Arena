/**
 * KMYAI'ye kişisel veri gitmez (KVKK). Öğrencinin yazdığı serbest metin
 * (asistan, topluluk) AI'ye gönderilmeden önce bu filtreden geçer.
 * Kural tabanlıdır; hedef aşırı temizlemek pahasına kaçırmamaktır.
 */

interface Kural {
  ad: string;
  desen: RegExp;
  yerine: string;
}

const KURALLAR: readonly Kural[] = [
  { ad: "eposta", desen: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, yerine: "[e-posta]" },
  { ad: "baglanti", desen: /\b(?:https?:\/\/|www\.)\S+/giu, yerine: "[bağlantı]" },
  // T.C. kimlik no: 11 hane, 0 ile başlamaz
  { ad: "tckn", desen: /(?<!\d)[1-9]\d{10}(?!\d)/g, yerine: "[kimlik]" },
  // Telefon: +90 / 0 ile başlayan 10-11 haneli, boşluk/tire/parantez olabilir
  { ad: "telefon", desen: /(?<!\d)(?:\+?90[\s-]?)?\(?0?5\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)/g, yerine: "[telefon]" },
  { ad: "kullanici_adi", desen: /(?<![\p{L}\p{N}])@[\p{L}\p{N}_.]{3,30}/gu, yerine: "[kullanıcı adı]" },
  { ad: "iban", desen: /\bTR\s?\d{2}(?:\s?\d{4}){5}\s?\d{2}\b/giu, yerine: "[iban]" },
];

export interface FiltreSonucu {
  metin: string;
  /** Hangi tür kişisel verinin temizlendiği (log/denetim için; değerin kendisi yok) */
  bulunanlar: string[];
}

export function kisiselVeriyiTemizle(girdi: string): FiltreSonucu {
  let metin = girdi;
  const bulunanlar: string[] = [];
  for (const k of KURALLAR) {
    const yeni = metin.replace(k.desen, k.yerine);
    if (yeni !== metin) bulunanlar.push(k.ad);
    metin = yeni;
  }
  return { metin, bulunanlar };
}

/**
 * Bilinen kişisel değerlerin (ad, soyad, takma ad, e-posta) metinde geçip
 * geçmediğini denetler. Giden her istek bu kontrolden geçer; eşleşme varsa
 * istek GÖNDERİLMEZ (kabul kriteri: KMYAI isteğinde öğrenci kimliği yok).
 */
export function yasakliDegerIceriyorMu(metin: string, yasaklilar: readonly string[]): boolean {
  const kucuk = metin.toLocaleLowerCase("tr-TR");
  return yasaklilar.some((y) => {
    const d = y.trim().toLocaleLowerCase("tr-TR");
    return d.length >= 3 && kucuk.includes(d);
  });
}
