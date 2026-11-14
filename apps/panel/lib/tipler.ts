export interface OgrenciDetayi {
  id: string; ad: string; takma_ad: string; son_giris: string | null; sinif: string | null; sube: string | null;
  ilerleme: { seviye: number; xp: number; seri: number; toplam_cevap: number; toplam_dogru: number; kupa: number } | null;
  risk: { puan: number; nedenler: string[] };
  gunluk: Array<{ gun: string; soru: number; dk: number }>;
  dersler: Array<{ ders: string; cozulen: number; haftalar: Array<{ hafta: string; n: number; dogruluk: number }> }>;
  guclu: Array<{ kod: string; aciklama: string; ustalik: string }>;
  zayif: Array<{ kod: string; aciklama: string }>;
  hata_defteri: number;
  odevler: Array<{ baslik: string; son_tarih: string; cozulen: number; soru_sayisi: number; bitis: string | null }>;
  duello: { toplam: number; galibiyet: number } | null;
  klan: string | null; rozet: number; veli_bagli: boolean;
  rehberlik: Array<{ id: string; tur: string; metin: string; plan_tarihi: string | null; tamamlandi: boolean; yazar: string; olusturma: string }> | null;
}
