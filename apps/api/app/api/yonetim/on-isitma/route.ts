import type { NextResponse } from "next/server";
import { mufredatGetir } from "@/lib/ayarlar";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ciftleriDoldur } from "@/lib/isler";
import { yonetimYetkisi } from "@/lib/yonetim-yetki";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const OPTIONS = onUcus;

/**
 * Ön ısıtma ve üretim testi: seçilen kazanımların bantlarına soru üretir ve
 * rapor döner (doğrulanan, reddedilen, atılma oranı, ortalama süre).
 * Yetki: CRON_SECRET veya merkez.ai_yonet.
 * Gövde: { kazanimKodlari?: string[], dersKodu?: string, bantlar?: number[], adet?: number }
 */
export async function POST(istek: Request): Promise<NextResponse> {
  return guvenli(async () => {
    await yonetimYetkisi(istek, "merkez.ai_yonet");
    const g = await govdeOku(istek);
    const m = await mufredatGetir();
    let kazanimlar = [...m.kazanimlar.values()];
    if (Array.isArray(g.kazanimKodlari) && g.kazanimKodlari.length > 0) {
      const kodlar = new Set(g.kazanimKodlari.map(String));
      kazanimlar = kazanimlar.filter((k) => kodlar.has(k.kod));
    } else if (typeof g.dersKodu === "string") {
      const d = m.dersKodla.get(g.dersKodu);
      kazanimlar = d ? (m.derseGore.get(d.id) ?? []) : [];
    }
    const bantlar = Array.isArray(g.bantlar) ? g.bantlar.map(Number).filter((b) => b >= 1 && b <= 5) : [1, 2, 3];
    const adet = Math.min(10, Math.max(1, Number(g.adet) || 3));
    if (kazanimlar.length === 0) throw new IstemciHatasi("soru.kazanimYok", 404);
    const ciftler = kazanimlar.flatMap((k) => bantlar.map((bant) => ({ kazanimId: k.id, bant, adet })));
    const ozet = await ciftleriDoldur(ciftler, 280_000, 1);
    return json({ ...ozet, istenenCift: ciftler.length, islenenCift: ozet.raporlar.length });
  });
}
