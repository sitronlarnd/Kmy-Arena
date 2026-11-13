import { after } from "next/server";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { kimlikDogrula, ogrenciGetir } from "@/lib/kimlik";
import { rozetleriKontrolEt } from "@/lib/oyun-servisi";
import * as TP from "@/lib/topluluk-servisi";

export const dynamic = "force-dynamic";
export const maxDuration = 90;
export const OPTIONS = onUcus;

const uuid = (d: unknown): string => {
  if (typeof d !== "string" || !/^[0-9a-f-]{36}$/i.test(d)) throw new IstemciHatasi("ortak.hata");
  return d;
};

/**
 * Topluluk soru-cevap (POST, oturum jetonuyla):
 *  akis {filtre?, dersId?, once?} · detay {soruId} · sor {dersId, kazanimId?, metin, gorsel?, gorunurluk?}
 *  cevapla {soruId, sik?, aciklama, gorsel?} · kabul {cevapId} · sikayet {hedefTur, hedefId, sebep}
 *  ogretmen-kabul {cevapId, ornek?} (personel)
 */
export async function POST(istek: Request, baglam: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await baglam.params;
    const g = await govdeOku(istek);
    if (islem === "ogretmen-kabul") {
      const kim = await kimlikDogrula(istek);
      return json(await TP.ogretmenKabul(kim.id, uuid(g.cevapId), g.ornek === true));
    }
    const k = await ogrenciGetir(istek);
    if (k.tur !== "ogrenci") throw new IstemciHatasi("soru.yalnizcaOgrenci", 403);
    switch (islem) {
      case "akis": return json(await TP.akis(k, g));
      case "detay": return json(await TP.detay(k, uuid(g.soruId)));
      case "sor": return json(await TP.sor(k, g));
      case "cevapla": {
        const r = await TP.cevapla(k, g);
        after(() => TP.cevabiDegerlendir(r.id));
        return json(r);
      }
      case "kabul": {
        const r = await TP.kabul(k, uuid(g.cevapId));
        return json({ ...r, yeniRozetler: await rozetleriKontrolEt(k) });
      }
      case "sikayet": await TP.sikayet(k, g); return json({ tamam: true });
      default: throw new IstemciHatasi("ortak.hata", 404);
    }
  });
}
