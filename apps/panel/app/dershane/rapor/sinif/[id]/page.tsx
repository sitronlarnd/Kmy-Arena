import { YazdirDugmesi } from "@/app/merkez/dershaneler/[id]/YazdirDugmesi";
import { PanelKabugu } from "@/bilesenler/PanelKabugu";
import { VeliRaporu } from "@/bilesenler/VeliRaporu";
import { panelRpc } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";
import type { OgrenciDetayi } from "@/lib/tipler";
import { denemeNetleri } from "@/lib/veli-rapor";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Sınıfın tamamı için veli raporları (her öğrenci ayrı sayfa). */
export default async function SinifRaporu({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("dershane");
  const { id } = await params;
  const s = await sunucuIstemcisi();
  const { data: ok } = await s.rpc("panel_sinif_analiz", { p_sinif: id }).then((r) => r, () => ({ data: null }));
  if (!ok) return <PanelKabugu baslik="Sınıf raporu" panel="dershane"><p>Bu sınıfı görme yetkiniz yok.</p></PanelKabugu>;
  const [{ data: uyeler }, { data: ds }, { data: sinif }] = await Promise.all([
    servis().from("sinif_uyelik").select("kullanici_id").eq("sinif_id", id).eq("rol", "ogrenci"),
    s.from("dershane").select("ad").maybeSingle(),
    servis().from("sinif").select("ad").eq("id", id).single(),
  ]);
  const raporlar = await Promise.all((uyeler ?? []).map(async (u) => {
    const d = await panelRpc<OgrenciDetayi>("panel_ogrenci_detay", { p_ogrenci: u.kullanici_id }).catch(() => null);
    return d ? { d, n: await denemeNetleri(u.kullanici_id as string) } : null;
  }));
  return (
    <PanelKabugu baslik={`${(sinif?.ad as string) ?? ""} · veli raporları`} panel="dershane" aktif="/dershane/ogrenciler" sag={<YazdirDugmesi />}>
      <div className="tam" style={{ display: "grid", gap: 20 }}>
        {raporlar.filter(Boolean).map((r) => r && <VeliRaporu key={r.d.id} d={r.d} dershane={(ds?.ad as string) ?? ""} denemeler={r.n} />)}
      </div>
    </PanelKabugu>
  );
}
