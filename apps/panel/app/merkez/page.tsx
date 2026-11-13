import { t } from "@kmy/shared/i18n";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Merkez() {
  await paneliKoru("merkez");
  return (
    <PanelKabugu baslik={t("panel.merkez")}>
      <Kart baslik="Genel bakış" aciklama="Dershane, öğrenci, MRR, KMYAI maliyeti ve brüt marj kartları (Faz 6)." />
      <a href="/merkez/ai" className="kart" style={{ textDecoration: "none", color: "inherit" }}>
        <h3>AI Merkezi →</h3>
        <p>Görev bazlı model ayarları (sürümlü, geri alınabilir), acil durum anahtarları, soru havuzu ısı haritası, ön ısıtma, token tüketimi ve atılma oranı. Prompt stüdyosu ve A/B testi Faz 6.</p>
      </a>
      <a href="/merkez/bayraklar" className="kart" style={{ textDecoration: "none", color: "inherit" }}>
        <h3>Özellik bayrakları →</h3>
        <p>Genel ve dershane bazında aç/kapa, kademeli açılış yüzdesi.</p>
      </a>
      <Kart baslik="Dershaneler" aciklama="Oluşturma sihirbazı, paketler, lisans durumu (Faz 6)." />
      <Kart baslik="Satış ve pilotlar" aciklama="Teklif hunisi, 30 gün pilot ve otomatik etki raporu (Faz 7)." />
    </PanelKabugu>
  );
}
