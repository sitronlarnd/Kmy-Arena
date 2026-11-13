import "server-only";

/**
 * Sunucu örneği içinde kısa ömürlü önbellek. Merkez Panelde yapılan bir
 * değişiklik en geç `ms` sonra devreye girer (kabul kriteri: model değişimi ≤ 1 dk).
 */
export function onbellekli<T>(ms: number, yukle: () => Promise<T>): { al: () => Promise<T>; temizle: () => void } {
  let deger: { v: T; zaman: number } | null = null;
  let bekleyen: Promise<T> | null = null;
  return {
    al: async () => {
      if (deger && Date.now() - deger.zaman < ms) return deger.v;
      bekleyen ??= yukle()
        .then((v) => {
          deger = { v, zaman: Date.now() };
          return v;
        })
        .finally(() => {
          bekleyen = null;
        });
      return bekleyen;
    },
    temizle: () => {
      deger = null;
    },
  };
}
