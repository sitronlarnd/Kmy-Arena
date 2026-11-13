import { guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { oyunDurumu, rozetleriKontrolEt } from "@/lib/oyun-servisi";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** Oyun durumu: ilerleme, seri, görevler (yoksa bugünün görevlerini oluşturur), rozetler, envanter. */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    if (k.tur !== "ogrenci") throw new IstemciHatasi("soru.yalnizcaOgrenci", 403);
    // Haftalık lig kapanışı gibi soru dışı olaylardan gelen rozetler de verilsin
    const yeniRozetler = await rozetleriKontrolEt(k);
    return json({ ...(await oyunDurumu(k)), yeniRozetler });
  });
}
