import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { ipucuAl } from "@/lib/soru-servisi";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** Sıradaki ipucu. Sayaç sunucuda tutulur ve XP çarpanına yansır. */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    const g = await govdeOku(istek);
    if (typeof g.soruId !== "string") throw new IstemciHatasi("ortak.hata");
    return json(await ipucuAl(k, g.soruId));
  });
}
