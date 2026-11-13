/**
 * Özellik bayrakları. Öncelik sırası (en güçlüden zayıfa):
 *   1) dershaneye özel bayrak kaydı
 *   2) dershanenin paketindeki özellik seti
 *   3) genel bayrak kaydı (yüzde ile kademeli yayın destekli)
 *   4) koddaki varsayılan
 * Aynı mantık veritabanında `app.ozellik_acik_mi()` fonksiyonunda vardır.
 */

export const OZELLIK_KODLARI = {
  duello: true,
  klan_savasi: true,
  topluluk: true,
  fotograftan_coz: true,
  dershaneler_arasi_lig: false,
  canli_soru_saati: true,
  asistan: true,
  veli_raporu: true,
  klan_sohbeti_serbest: false,
} as const satisfies Record<string, boolean>;

export type OzellikKodu = keyof typeof OZELLIK_KODLARI;

export interface BayrakKaydi {
  kod: string;
  /** null → genel bayrak */
  dershaneId: string | null;
  acik: boolean;
  /** 0-100; genel bayrakta kademeli yayın yüzdesi */
  yuzde: number;
}

/** FNV-1a: dershane kimliğine göre kararlı 0-99 kova. */
export function kova(anahtar: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < anahtar.length; i++) {
    h ^= anahtar.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 100;
}

export function ozellikAcikMi(
  kod: OzellikKodu,
  dershaneId: string,
  kayitlar: readonly BayrakKaydi[],
  paketOzellikleri: Readonly<Partial<Record<string, boolean>>> = {},
): boolean {
  const ozel = kayitlar.find((k) => k.kod === kod && k.dershaneId === dershaneId);
  if (ozel) return ozel.acik;
  const paket = paketOzellikleri[kod];
  if (paket !== undefined) return paket;
  const genel = kayitlar.find((k) => k.kod === kod && k.dershaneId === null);
  if (genel) return genel.acik && kova(`${kod}:${dershaneId}`) < genel.yuzde;
  return OZELLIK_KODLARI[kod];
}
