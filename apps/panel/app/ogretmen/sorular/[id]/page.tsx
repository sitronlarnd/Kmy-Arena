import { notFound } from "next/navigation";
import { PanelKabugu } from "@/bilesenler/PanelKabugu";
import { kazanimListesi } from "@/lib/mufredat";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";
import { SoruEditoru } from "../SoruEditoru";
import type { SoruGirdisi } from "../eylemler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function SoruDuzenle({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("ogretmen");
  const { id } = await params;
  const s = await sunucuIstemcisi();
  const { data: x } = await s.from("soru").select("id, kazanim_id, govde_md, siklar, dogru, zorluk, soru_tipi, cozum_adimlari, paylasim, ogretmen_cozum").eq("id", id).maybeSingle();
  if (!x) notFound();
  const ilk: SoruGirdisi = {
    id: x.id as string, kazanimId: x.kazanim_id as string, govde: x.govde_md as string, siklar: x.siklar as Record<string, string>, dogru: x.dogru as string,
    zorluk: Number(x.zorluk), tip: x.soru_tipi as string, cozumAdimlari: (x.cozum_adimlari as string[]) ?? [], paylasim: x.paylasim as "kendim" | "dershane",
    cozum: (x.ogretmen_cozum as SoruGirdisi["cozum"]) ?? null,
  };
  return (
    <PanelKabugu baslik="Soruyu düzenle" panel="ogretmen" aktif="/ogretmen/sorular" yol={<><a href="/ogretmen/sorular">Soru arşivim</a> › Düzenle</>}>
      <div className="kart genis"><SoruEditoru kazanimlar={await kazanimListesi()} ilk={ilk} /></div>
    </PanelKabugu>
  );
}
