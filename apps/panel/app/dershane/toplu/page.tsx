import { KayitFormu } from "@/bilesenler/Kayit";
import type { OgrenciSatiri } from "@/bilesenler/OgrenciTablosu";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { panelRpc } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { yilSonu } from "./eylemler";
import { TopluSecim } from "./TopluSecim";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export default async function Toplu() {
  await paneliKoru("dershane");
  const k = await yetkiIste("ogrenci.ekle");
  const yapi = await yetkiIste("sinif.yonet").then(() => true, () => false);
  const [o, { data: siniflar }] = await Promise.all([
    panelRpc<OgrenciSatiri[]>("panel_ogrenciler"),
    servis().from("sinif").select("id, ad, seviye, sube_id, sube:sube_id(ad)").eq("dershane_id", k.dershaneId).eq("arsiv", false).order("seviye").order("ad"),
  ]);
  const sl = ((siniflar ?? []) as unknown as { id: string; ad: string; seviye: number; sube_id: string; sube: { ad: string } | null }[]).filter((c) => k.tum || k.subeler.includes(c.sube_id));
  return (
    <PanelKabugu baslik="Toplu işlemler" panel="dershane" aktif="/dershane/toplu">
      <Kart genis baslik="Öğrenci seç ve uygula" aciklama="Satırlara tıklayarak seçin; seçili öğrencileri başka sınıfa taşıyın, duyuru gönderin ya da kişisel telafi ödevi verin. Sınıfın veli toplantısı raporları için aşağıdaki listeyi kullanın.">
        <TopluSecim ogrenciler={o} siniflar={sl.map((c) => ({ id: c.id, ad: `${c.ad} · ${c.sube?.ad ?? ""}` }))} />
      </Kart>
      <Kart genis baslik="Veli toplantısı raporları" aciklama="Her öğrenci için tek sayfalık rapor (çalışma süresi, gelişim, güçlü/zayıf konular, deneme netleri, öğretmen notu alanı). Sınıfın tamamını tek seferde yazdırabilirsiniz.">
        <div className="form" style={{ marginTop: 8 }}>{sl.map((c) => <a key={c.id} className="dugme kucuk ikincil" href={`/dershane/rapor/sinif/${c.id}`}>{c.ad} · {c.sube?.ad}</a>)}</div>
      </Kart>
      {yapi && k.tum && (
        <Kart genis baslik="Yıl sonu: sınıf atlatma ve mezunlar" aciklama="Her sınıf için ne olacağını seçin. “Seviyeyi yükselt” aynı sınıfı bir üst seviyeye taşır (ör. 7-A → 8. sınıf; adını Şubeler ve sınıflar sayfasından değiştirebilirsiniz). “Mezun et” sınıfı arşive alır; öğrencilerin verisi silinmez. İşlem denetim kaydına yazılır.">
          <KayitFormu eylem={yilSonu} dugme="Yıl sonunu uygula">
            <table className="tablo" style={{ width: "100%" }}>
              <thead><tr><th>Sınıf</th><th>Seviye</th><th>İşlem</th></tr></thead>
              <tbody>{sl.map((c) => (
                <tr key={c.id}><td><b>{c.ad}</b> <span className="soluk">{c.sube?.ad}</span></td><td>{c.seviye === 13 ? "Mezun" : c.seviye}</td>
                  <td><select name={`islem_${c.id}`} className="alan" defaultValue="kal">
                    <option value="kal">Değişiklik yok</option>
                    <option value="seviye">Seviyeyi yükselt</option>
                    <option value="mezun">Mezun et (arşivle)</option>
                    {sl.filter((x) => x.id !== c.id).map((x) => <option key={x.id} value={`tasi:${x.id}`}>Öğrencileri taşı → {x.ad} · {x.sube?.ad}</option>)}
                  </select></td></tr>
              ))}</tbody>
            </table>
          </KayitFormu>
        </Kart>
      )}
    </PanelKabugu>
  );
}
