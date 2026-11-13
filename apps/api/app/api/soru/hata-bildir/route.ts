import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { hataBildir } from "@/lib/soru-servisi";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** "Soruda hata var": öğretmen onaylarsa XP iadesi + bonus (Faz 6 paneli). */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    const g = await govdeOku(istek);
    if (typeof g.soruId !== "string") throw new IstemciHatasi("ortak.hata");
    await hataBildir(k, g.soruId, typeof g.aciklama === "string" ? g.aciklama : null);
    return json({ tamam: true });
  });
}
