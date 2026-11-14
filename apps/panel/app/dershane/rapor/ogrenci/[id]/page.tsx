import { YazdirDugmesi } from "@/app/merkez/dershaneler/[id]/YazdirDugmesi";
import { PanelKabugu } from "@/bilesenler/PanelKabugu";
import { VeliRaporu } from "@/bilesenler/VeliRaporu";
import { panelRpc } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";
import type { OgrenciDetayi } from "@/lib/tipler";
import { denemeNetleri } from "@/lib/veli-rapor";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function OgrenciRaporu({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("dershane");
  const { id } = await params;
  const d = await panelRpc<OgrenciDetayi>("panel_ogrenci_detay", { p_ogrenci: id });
  const { data: ds } = await (await sunucuIstemcisi()).from("dershane").select("ad").maybeSingle();
  return (
    <PanelKabugu baslik="Veli görüşmesi raporu" panel="dershane" aktif="/dershane/ogrenciler" sag={<YazdirDugmesi />}>
      <div className="tam"><VeliRaporu d={d} dershane={(ds?.ad as string) ?? ""} denemeler={await denemeNetleri(id)} /></div>
    </PanelKabugu>
  );
}
