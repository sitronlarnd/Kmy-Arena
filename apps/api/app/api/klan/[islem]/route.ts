import * as KL from "@/lib/klan-servisi";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { kimlikDogrula, ogrenciGetir, sosyalGerekli } from "@/lib/kimlik";
import { rozetleriKontrolEt } from "@/lib/oyun-servisi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const OPTIONS = onUcus;

const uuid = (d: unknown): string => {
  if (typeof d !== "string" || !/^[0-9a-f-]{36}$/i.test(d)) throw new IstemciHatasi("ortak.hata");
  return d;
};

/**
 * Klan uçları (POST, oturum jetonuyla):
 *  durum · kur {ad, slogan?, amblem{kalkan,simge,renk}, katilim} · katil {klanId} · ayril
 *  basvuru-yanit {id, kabul} · davet {takmaAd} · yonet {hedef, islem}
 *  mesajlar {sonra?} · mesaj {tur: hazir|soru|serbest, kod?, soruId?, metin?} · sikayet {hedefTur, hedefId, sebep}
 *  onay {klanId, kabul} (personel)
 */
export async function POST(istek: Request, baglam: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await baglam.params;
    const g = await govdeOku(istek);
    if (islem === "onay") {
      const kim = await kimlikDogrula(istek);
      await KL.onay(kim.id, uuid(g.klanId), g.kabul === true);
      return json({ tamam: true });
    }
    const k = await ogrenciGetir(istek);
    if (k.tur !== "ogrenci") throw new IstemciHatasi("soru.yalnizcaOgrenci", 403);
    switch (islem) {
      case "durum": return json(await KL.durum(k));
      case "kur": {
        const r = await KL.kur(k, g);
        return json({ ...r, yeniRozetler: await rozetleriKontrolEt(k) });
      }
      case "katil": {
        const sonuc = await KL.katil(k, uuid(g.klanId));
        return json({ sonuc, yeniRozetler: sonuc === "katildi" ? await rozetleriKontrolEt(k) : [] });
      }
      case "ayril": await KL.ayril(k); return json({ tamam: true });
      case "basvuru-yanit": {
        await KL.basvuruYanit(k, uuid(g.id), g.kabul === true);
        return json({ tamam: true, yeniRozetler: g.kabul === true ? await rozetleriKontrolEt(k) : [] });
      }
      case "davet": {
        if (typeof g.takmaAd !== "string" || g.takmaAd.trim().length < 3 || g.takmaAd.length > 40) throw new IstemciHatasi("klan.kullaniciYok");
        await KL.davet(k, g.takmaAd);
        return json({ tamam: true });
      }
      case "yonet": await KL.yonet(k, uuid(g.hedef), String(g.islem ?? "")); return json({ tamam: true });
      case "mesajlar": return json(await KL.mesajlar(k, Number(g.sonra) || 0));
      case "mesaj": sosyalGerekli(k); return json(await KL.mesaj(k, g));
      case "sikayet": await KL.sikayet(k, g); return json({ tamam: true });
      default: throw new IstemciHatasi("ortak.hata", 404);
    }
  });
}
