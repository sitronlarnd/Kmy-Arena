import { tr, type Metinler } from "./tr";

type Yol<T, On extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${On}${K}` : Yol<T[K], `${On}${K}.`>;
}[keyof T & string];

export type MetinAnahtari = Yol<Metinler>;

/** Noktalı anahtarla metin getirir: t("giris.baslik"). {ad} biçimli değişkenleri doldurur. */
export function t(anahtar: MetinAnahtari, degiskenler?: Readonly<Record<string, string | number>>): string {
  let deger: unknown = tr;
  for (const parca of anahtar.split(".")) {
    deger = (deger as Record<string, unknown>)[parca];
  }
  let metin = typeof deger === "string" ? deger : anahtar;
  if (degiskenler) {
    for (const [k, v] of Object.entries(degiskenler)) metin = metin.replaceAll(`{${k}}`, String(v));
  }
  return metin;
}

export { tr };
