import { govdeOku, guvenli, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { cevapIsteginiCoz, cevapVer } from "@/lib/soru-servisi";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** Cevabı sunucu değerlendirir; XP, Altın ve beceri yalnızca burada hesaplanır. */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    return json(await cevapVer(k, cevapIsteginiCoz(await govdeOku(istek))));
  });
}
