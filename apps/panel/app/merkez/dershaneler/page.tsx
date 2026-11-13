import { lisansGuncelle } from "@/app/merkez/eylemler";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Dershaneler() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.dershane_yonet");
  const s = servis();
  const { data: dershaneler } = await s.from("dershane").select("id, ad, lisans_durumu, lisans_baslangic, lisans_bitis, ogrenci_limiti").order("ad");
  const satirlar = await Promise.all((dershaneler ?? []).map(async (d) => {
    const [{ count: ogrenci }, { count: soru30 }] = await Promise.all([
      s.from("kullanici").select("id", { count: "exact", head: true }).eq("dershane_id", d.id).eq("tur", "ogrenci"),
      s.from("cevap").select("id", { count: "exact", head: true }).eq("dershane_id", d.id).gte("olusturma", new Date(Date.now() - 30 * 86400000).toISOString()),
    ]);
    return { ...d, ogrenci: ogrenci ?? 0, soru30: soru30 ?? 0 };
  }));
  return (
    <PanelKabugu baslik="Dershaneler" panel="merkez" aktif="/merkez/dershaneler">
      <Kart genis aciklama="Lisans durumu, koltuk ve son 30 gün kullanımı. Pilot raporu satış görüşmesi için yazdırılabilir / PDF olarak kaydedilebilir.">
        <div className="kaydir" style={{ marginTop: 12 }}>
          <table className="tablo">
            <thead><tr><th>Dershane</th><th>Öğrenci</th><th>30 gün soru</th><th>Lisans</th><th /></tr></thead>
            <tbody>
              {satirlar.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.ad}</b><div className="soluk kucuk">Başlangıç {tarih(d.lisans_baslangic)}</div></td>
                  <td>{d.ogrenci} / {d.ogrenci_limiti}</td>
                  <td>{d.soru30.toLocaleString("tr-TR")}</td>
                  <td>
                    <form action={lisansGuncelle} className="form">
                      <input type="hidden" name="id" value={d.id} />
                      <select name="durum" defaultValue={d.lisans_durumu} className="alan">{["pilot", "aktif", "gecikmis", "askida", "bitti"].map((x) => <option key={x}>{x}</option>)}</select>
                      <input name="limit" type="number" min={1} defaultValue={d.ogrenci_limiti} className="alan" style={{ width: 90 }} />
                      <input name="bitis" type="date" defaultValue={d.lisans_bitis ?? ""} className="alan" />
                      <button className="dugme kucuk">Kaydet</button>
                    </form>
                  </td>
                  <td><a className="dugme kucuk ikincil" href={`/merkez/dershaneler/${d.id}`}>Pilot raporu</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
