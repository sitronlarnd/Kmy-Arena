import { govdeOku, guvenli, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { satinAl } from "@/lib/oyun-servisi";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** Mağaza: fiyat ve seviye koşulu sunucudaki katalogdan; istemcinin gönderdiği fiyata güvenilmez. */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    const g = await govdeOku(istek);
    return json(await satinAl(k, String(g.kod ?? "")));
  });
}
