import * as AS from "@/lib/asistan-servisi";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const OPTIONS = onUcus;

const uuid = (d: unknown): string => {
  if (typeof d !== "string" || !/^[0-9a-f-]{36}$/i.test(d)) throw new IstemciHatasi("ortak.hata");
  return d;
};

/**
 * Sokratik asistan ve fotoğraftan çöz (POST, oturum jetonuyla):
 *  soru {soruId} · oturum {oturumId} · mesaj {oturumId, metin} · cozum {oturumId} · fotograf {gorsel: base64 jpeg}
 */
export async function POST(istek: Request, baglam: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await baglam.params;
    const k = await ogrenciGetir(istek);
    if (k.tur !== "ogrenci") throw new IstemciHatasi("soru.yalnizcaOgrenci", 403);
    const g = await govdeOku(istek);
    switch (islem) {
      case "soru": return json(await AS.soruOturumu(k, uuid(g.soruId)));
      case "oturum": return json(await AS.oturumDurumu(k, uuid(g.oturumId)));
      case "mesaj": return json(await AS.mesajGonder(k, uuid(g.oturumId), typeof g.metin === "string" ? g.metin : ""));
      case "cozum": return json(await AS.tamCozum(k, uuid(g.oturumId)));
      case "fotograf":
        if (typeof g.gorsel !== "string") throw new IstemciHatasi("fotograf.gecersiz");
        return json(await AS.fotografCoz(k, g.gorsel));
      default: throw new IstemciHatasi("ortak.hata", 404);
    }
  });
}
