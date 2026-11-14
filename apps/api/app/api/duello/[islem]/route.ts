import * as D from "@/lib/duello-servisi";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ogrenciGetir, yazmaGerekli } from "@/lib/kimlik";
import { rozetleriKontrolEt } from "@/lib/oyun-servisi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const OPTIONS = onUcus;

const metin = (d: unknown): string | undefined => (typeof d === "string" && d.length > 0 && d.length < 80 ? d : undefined);
const uuid = (d: unknown): string => {
  if (typeof d !== "string" || !/^[0-9a-f-]{36}$/i.test(d)) throw new IstemciHatasi("ortak.hata");
  return d;
};

/**
 * Düello uçları (hepsi POST, oturum jetonuyla):
 *  kuyruk {dersKodu?} · kuyruktan-cik · robot {dersKodu?} · davet {dersKodu?} · katil {kod}
 *  asenkron {takmaAd, dersKodu?} · durum {id} · cevap {id, sira, secilen|null, rttMs}
 *  sekme {id} · tepki {id, kod} · rovans {id} · gecmis
 */
export async function POST(istek: Request, baglam: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await baglam.params;
    const k = await ogrenciGetir(istek);
    if (!["durum", "gecmis"].includes(islem)) yazmaGerekli(k);
    if (k.tur !== "ogrenci") throw new IstemciHatasi("soru.yalnizcaOgrenci", 403);
    const g = await govdeOku(istek);
    switch (islem) {
      case "kuyruk": return json(await D.kuyruk(k, metin(g.dersKodu)));
      case "kuyruktan-cik": await D.kuyruktanCik(k); return json({ tamam: true });
      case "robot": return json(await D.robotDuello(k, metin(g.dersKodu)));
      case "davet": return json(await D.davetOlustur(k, metin(g.dersKodu)));
      case "katil": return json(await D.davetKatil(k, metin(g.kod) ?? ""));
      case "asenkron": return json(await D.asenkronOlustur(k, metin(g.takmaAd) ?? "", metin(g.dersKodu)));
      case "durum": {
        const d = (await D.durum(k, uuid(g.id))) as { durum?: string };
        // Düello bittiyse düello rozetleri (idempotent)
        const yeniRozetler = d.durum === "bitti" ? await rozetleriKontrolEt(k) : [];
        return json({ ...d, yeni_rozetler: yeniRozetler });
      }
      case "cevap": {
        const secilen = g.secilen === null ? null : metin(g.secilen);
        if (secilen !== null && (!secilen || !/^[A-E]$/.test(secilen))) throw new IstemciHatasi("ortak.hata");
        return json(await D.cevapla(k, uuid(g.id), Number(g.sira), secilen ?? null, Number(g.rttMs) || 0));
      }
      case "sekme": return json({ uyari: await D.sekme(k, uuid(g.id)) });
      case "tepki": await D.tepki(k, uuid(g.id), metin(g.kod) ?? ""); return json({ tamam: true });
      case "rovans": return json(await D.rovans(k, uuid(g.id)));
      case "gecmis": return json(await D.gecmis(k));
      default: throw new IstemciHatasi("ortak.hata", 404);
    }
  });
}
