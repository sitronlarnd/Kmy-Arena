import "server-only";
import type { DenemeSatiri } from "@/bilesenler/VeliRaporu";
import { servis } from "./servis";

/** Öğrencinin deneme toplam netleri (erişim panel_ogrenci_detay ile önceden doğrulanır). */
export async function denemeNetleri(ogrenci: string): Promise<DenemeSatiri[]> {
  const { data } = await servis().from("deneme_sonuc").select("net, deneme:deneme_id(ad, tarih)").eq("kullanici_id", ogrenci);
  const m = new Map<string, DenemeSatiri>();
  for (const r of (data ?? []) as unknown as { net: number; deneme: { ad: string; tarih: string } | null }[]) {
    if (!r.deneme) continue;
    const k = r.deneme.ad + r.deneme.tarih;
    const x = m.get(k) ?? { ad: r.deneme.ad, tarih: r.deneme.tarih, net: 0 };
    x.net = Math.round((x.net + Number(r.net)) * 100) / 100;
    m.set(k, x);
  }
  return [...m.values()].sort((a, b) => a.tarih.localeCompare(b.tarih));
}
