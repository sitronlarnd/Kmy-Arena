/** Topluluk yardımcıları */
export interface AkisSorusu {
  id: string; metin: string; gorselli: boolean; durum: "acik" | "cozuldu"; gorunurluk: string; olusturma: string;
  ders: string; ders_kod: string; kazanim_kod: string | null; soran: string; benim: boolean; cevap_sayisi: number; cevapladim: boolean; ipuclu: boolean;
}

export function ne_zaman(iso: string): string {
  const dk = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (dk < 1) return "şimdi";
  if (dk < 60) return `${dk} dk`;
  if (dk < 1440) return `${Math.floor(dk / 60)} sa`;
  return `${Math.floor(dk / 1440)} g`;
}

