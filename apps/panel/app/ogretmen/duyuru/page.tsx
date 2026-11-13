import { duyuruGonder } from "@/app/ogretmen/eylemler";
import { EylemFormu } from "@/bilesenler/Istemci";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Duyuru() {
  await paneliKoru("ogretmen");
  const siniflar = await panelRpc<Array<{ id: string; ad: string; ogretmenim: boolean }>>("panel_siniflarim");
  return (
    <PanelKabugu baslik="Sınıf duyurusu" panel="ogretmen" aktif="/ogretmen/duyuru">
      <Kart genis baslik="Yeni duyuru" aciklama="Duyuru öğrencilerin Arena ekranında 14 gün görünür.">
        <div style={{ marginTop: 14 }}>
          <EylemFormu eylem={duyuruGonder} dugme="Gönder">
            <label>Sınıf<select name="sinif" className="alan">{siniflar.filter((s) => s.ogretmenim).map((s) => <option key={s.id} value={s.id}>{s.ad}</option>)}</select></label>
            <label>Başlık<input name="baslik" className="alan" maxLength={120} /></label>
            <label>Metin<textarea name="metin" className="alan" rows={4} maxLength={1000} /></label>
          </EylemFormu>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
