import { ayarKaydet, genelDuyuru } from "@/app/dershane/eylemler";
import { EylemFormu } from "@/bilesenler/Istemci";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Ayarlar() {
  await paneliKoru("dershane");
  const s = await sunucuIstemcisi();
  const [{ data: d }, { data: subeler }, { data: bayraklar }] = await Promise.all([
    s.from("dershane").select("id, ad, ayarlar").single(),
    s.from("sube").select("id, ad").order("ad"),
    s.from("ozellik_bayragi").select("kod, acik, dershane_id"),
  ]);
  const a = (d?.ayarlar ?? {}) as Record<string, unknown>;
  const bayrak = (kod: string) => {
    const b = (bayraklar ?? []).find((x) => x.kod === kod && x.dershane_id === d?.id) ?? (bayraklar ?? []).find((x) => x.kod === kod && !x.dershane_id);
    return Boolean(b?.acik);
  };
  return (
    <PanelKabugu baslik="Ayarlar ve duyuru" panel="dershane" aktif="/dershane/ayarlar">
      <Kart baslik="Dershane ayarları" aciklama="Merkezin izin verdiği aralıklarda değiştirilebilir. Her değişiklik denetim kaydına yazılır.">
        <div style={{ marginTop: 14 }}>
          <EylemFormu eylem={ayarKaydet} dugme="Kaydet">
            <label>Canlı Soru Saati<input name="canli_saat" type="time" className="alan" defaultValue={String(a.canli_saat ?? "19:30")} /></label>
            <label>Günlük soru hedefi (5-50)<input name="gunluk_hedef" type="number" min={5} max={50} className="alan" defaultValue={Number(a.gunluk_hedef ?? 10)} /></label>
            <div className="form">
              <label>Bildirim sessiz saati başı<input name="sessiz_baslangic" type="time" className="alan" defaultValue={String(a.sessiz_baslangic ?? "22:00")} /></label>
              <label>bitişi<input name="sessiz_bitis" type="time" className="alan" defaultValue={String(a.sessiz_bitis ?? "08:00")} /></label>
            </div>
            <label>Karşılama mesajı<input name="karsilama" className="alan" maxLength={200} defaultValue={String(a.karsilama ?? "")} /></label>
            <label className="satir" style={{ cursor: "pointer" }}><input type="checkbox" name="klan_onayi" defaultChecked={Boolean(a.klan_onayi)} style={{ minHeight: 0 }} /> Klan adları öğretmen onayından geçsin</label>
            <label className="satir" style={{ cursor: "pointer" }}><input type="checkbox" name="klan_sohbeti_serbest" defaultChecked={bayrak("klan_sohbeti_serbest")} style={{ minHeight: 0 }} /> Klan sohbetinde serbest yazışma (filtreli)</label>
            <label className="satir" style={{ cursor: "pointer" }}><input type="checkbox" name="dershaneler_arasi_lig" defaultChecked={bayrak("dershaneler_arasi_lig")} style={{ minHeight: 0 }} /> Dershaneler arası ligde yer al</label>
          </EylemFormu>
        </div>
      </Kart>
      <Kart baslik="Duyuru" aciklama="Tüm dershaneye ya da bir şubeye. Öğrencilerin Arena ekranında 14 gün görünür.">
        <div style={{ marginTop: 14 }}>
          <EylemFormu eylem={genelDuyuru} dugme="Gönder">
            <label>Kime<select name="sube" className="alan"><option value="">Tüm dershane</option>{(subeler ?? []).map((x) => <option key={x.id} value={x.id}>{x.ad}</option>)}</select></label>
            <label>Başlık<input name="baslik" className="alan" maxLength={120} /></label>
            <label>Metin<textarea name="metin" className="alan" rows={4} maxLength={1000} /></label>
          </EylemFormu>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
