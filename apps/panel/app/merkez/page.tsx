import { t } from "@kmy/shared/i18n";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Merkez() {
  await paneliKoru("merkez");
  return (
    <PanelKabugu baslik={t("panel.merkez")}>
      <Kart baslik="Genel bakış" aciklama="Dershane, öğrenci, MRR, KMYAI maliyeti ve brüt marj kartları (Faz 6)." />
      <Kart baslik="AI Merkezi" aciklama="Görev bazlı model ataması, prompt stüdyosu, A/B testi, tampon izleme (temel hâli Faz 1)." />
      <Kart baslik="Dershaneler" aciklama="Oluşturma sihirbazı, paketler, özellik bayrakları, lisans durumu (Faz 6)." />
      <Kart baslik="Satış ve pilotlar" aciklama="Teklif hunisi, 30 gün pilot ve otomatik etki raporu (Faz 7)." />
    </PanelKabugu>
  );
}
