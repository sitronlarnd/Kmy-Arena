import { t } from "@kmy/shared/i18n";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { paneliKoru } from "@/lib/yetki";
import { sunucuIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Ogretmen() {
  await paneliKoru("ogretmen");
  const supabase = await sunucuIstemcisi();
  // RLS: öğretmen yalnızca atandığı sınıfların öğrencilerini görür.
  const { count } = await supabase.from("kullanici").select("id", { count: "exact", head: true }).eq("tur", "ogrenci");
  return (
    <PanelKabugu baslik={t("panel.ogretmen")}>
      <Kart baslik="Sınıflarım" aciklama={`${count ?? 0} öğrenci`} />
      <Kart baslik="Soru ve çözüm yükleme, AI ile soru ürettirme" aciklama="Faz 6." />
      <Kart baslik="Kazanım ısı haritası ve Bekleyenler" aciklama="Faz 6." />
    </PanelKabugu>
  );
}
