import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { OgrenciTablosu, type OgrenciSatiri } from "@/bilesenler/OgrenciTablosu";
import { panelRpc } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Ogrenciler() {
  await paneliKoru("dershane");
  const o = await panelRpc<OgrenciSatiri[]>("panel_ogrenciler");
  return (
    <PanelKabugu baslik="Öğrenciler" panel="dershane" aktif="/dershane/ogrenciler">
      <Kart genis aciklama="Risk skoru destek içindir: uzun süre çalışmama, haftalık düşüş, kaçırılan ödev, doğrulukta düşüş ve tek konuya sıkışma sinyallerinden hesaplanır. Bir öğrenciye tıklayınca 360° görünüm açılır.">
        <div className="form" style={{ justifyContent: "flex-end", marginBottom: 10 }}><a className="dugme kucuk ikincil" href="/dershane/ogrenciler/excel">Excel olarak indir</a><a className="dugme kucuk" href="/dershane/kayit">+ Öğrenci ekle</a></div>
        <OgrenciTablosu ogrenciler={o} yonet />
      </Kart>
    </PanelKabugu>
  );
}
