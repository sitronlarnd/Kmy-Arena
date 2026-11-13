import { t } from "@kmy/shared/i18n";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { paneliKoru } from "@/lib/yetki";
import { sunucuIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Dershane() {
  await paneliKoru("dershane");
  const supabase = await sunucuIstemcisi();
  // RLS: kullanıcı yalnızca kendi dershanesini ve yetkili olduğu öğrencileri görür.
  const [{ data: dershane }, { count: ogrenci }] = await Promise.all([
    supabase.from("dershane").select("ad, lisans_durumu, ogrenci_limiti").single(),
    supabase.from("kullanici").select("id", { count: "exact", head: true }).eq("tur", "ogrenci"),
  ]);
  return (
    <PanelKabugu baslik={`${t("panel.dershane")} · ${dershane?.ad ?? ""}`}>
      <Kart baslik="Öğrenciler" aciklama={`${ogrenci ?? 0} / ${dershane?.ogrenci_limiti ?? "-"} koltuk kullanılıyor`} />
      <Kart baslik="Lisans" aciklama={`Durum: ${dershane?.lisans_durumu ?? "-"}`} />
      <Kart baslik="Öğrenci 360°, erken uyarı, raporlar" aciklama="Faz 6'da açılacak." />
    </PanelKabugu>
  );
}
