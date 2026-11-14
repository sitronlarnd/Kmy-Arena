import { PanelKabugu } from "@/bilesenler/PanelKabugu";
import { kazanimListesi } from "@/lib/mufredat";
import { paneliKoru } from "@/lib/yetki";
import { SoruEditoru } from "../SoruEditoru";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function YeniSoru() {
  await paneliKoru("ogretmen");
  return (
    <PanelKabugu baslik="Soru ekle" panel="ogretmen" aktif="/ogretmen/sorular" yol={<><a href="/ogretmen/sorular">Soru arşivim</a> › Yeni</>}>
      <div className="kart genis"><SoruEditoru kazanimlar={await kazanimListesi()} /></div>
    </PanelKabugu>
  );
}
