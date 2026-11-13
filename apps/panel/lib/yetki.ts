import type { YetkiKodu } from "@kmy/shared";
import { redirect } from "next/navigation";
import { sunucuIstemcisi } from "./supabase";

export interface YetkiSatiri {
  yetki_kod: YetkiKodu;
  dershane_id: string | null;
  sube_id: string | null;
}

export type Panel = "merkez" | "dershane" | "ogretmen";

/** Her panelin açılması için gereken yetkilerden en az biri. */
const PANEL_YETKILERI: Record<Panel, readonly YetkiKodu[]> = {
  merkez: ["merkez.dershane_yonet", "merkez.ai_yonet", "merkez.destek", "merkez.satis", "merkez.mufredat_yonet"],
  dershane: ["dershane.ayar", "rapor.oku", "ogrenci.ekle", "rehberlik.oku"],
  ogretmen: ["odev.yonet", "soru.yukle"],
};

export async function yetkilerim(): Promise<YetkiSatiri[]> {
  const supabase = await sunucuIstemcisi();
  const { data, error } = await supabase.rpc("yetkilerim");
  if (error) throw new Error(error.message);
  return (data ?? []) as YetkiSatiri[];
}

export function paneleErisebilir(yetkiler: readonly YetkiSatiri[], panel: Panel): boolean {
  const gerekli = PANEL_YETKILERI[panel];
  return yetkiler.some(
    (y) => gerekli.includes(y.yetki_kod) && (panel === "merkez" ? y.dershane_id === null : y.dershane_id !== null),
  );
}

/** Sunucu bileşeninde: yetki yoksa ana sayfaya yönlendirir. */
export async function paneliKoru(panel: Panel): Promise<YetkiSatiri[]> {
  const yetkiler = await yetkilerim();
  if (!paneleErisebilir(yetkiler, panel)) redirect("/?yetkisiz=1");
  return yetkiler;
}
