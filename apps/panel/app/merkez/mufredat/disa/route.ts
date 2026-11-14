import { servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";

export const dynamic = "force-dynamic";

/** Tüm müfredat JSON dışa aktarma (içe aktarmayla aynı biçim). */
export async function GET() {
  await merkezYetkisi("merkez.mufredat_yonet");
  const { data } = await servis().from("kazanim").select("kod, aciklama, sinif_duzeyi, sinav_turu, on_kosullar, soru_tipi_agirliklari, unite:unite_id(kod, ad, ders:ders_id(kod, ad))").order("kod");
  const l = (data ?? []) as unknown as { kod: string; aciklama: string; sinif_duzeyi: number; sinav_turu: string; on_kosullar: string[]; soru_tipi_agirliklari: Record<string, number>; unite: { kod: string; ad: string; ders: { kod: string; ad: string } | null } | null }[];
  const { data: idler } = await servis().from("kazanim").select("id, kod");
  const kodOf = new Map((idler ?? []).map((x) => [x.id as string, x.kod as string]));
  const cikti = { surum: new Date().toISOString(), kazanimlar: l.map((k) => ({ kod: k.kod, aciklama: k.aciklama, sinav: k.sinav_turu, sinif: k.sinif_duzeyi, ders_kod: k.unite?.ders?.kod, unite_kod: k.unite?.kod, unite: k.unite?.ad, on_kosullar: k.on_kosullar.map((x) => kodOf.get(x)).filter(Boolean), soru_tipi_agirliklari: k.soru_tipi_agirliklari })) };
  return new Response(JSON.stringify(cikti, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="kmy-mufredat-${new Date().toISOString().slice(0, 10)}.json"` } });
}
