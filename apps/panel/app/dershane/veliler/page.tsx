import { veliKodlari } from "@/app/dershane/kayit/eylemler";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Cubuk, Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Veliler() {
  await paneliKoru("dershane");
  const k = await yetkiIste("veli.davet");
  const s = servis();
  const [{ data: siniflar }, { data: uyelik }, { data: baglar }] = await Promise.all([
    s.from("sinif").select("id, ad, sube_id, sube:sube_id(ad)").eq("dershane_id", k.dershaneId).eq("arsiv", false).order("ad"),
    s.from("sinif_uyelik").select("sinif_id, kullanici_id").eq("dershane_id", k.dershaneId).eq("rol", "ogrenci"),
    s.from("veli_bag").select("ogrenci_id").eq("dershane_id", k.dershaneId).not("onay_tarihi", "is", null),
  ]);
  const bagli = new Set((baglar ?? []).map((b) => b.ogrenci_id as string));
  const sl = ((siniflar ?? []) as unknown as { id: string; ad: string; sube_id: string; sube: { ad: string } | null }[]).filter((c) => k.tum || k.subeler.includes(c.sube_id));
  const satir = sl.map((c) => {
    const o = (uyelik ?? []).filter((u) => u.sinif_id === c.id).map((u) => u.kullanici_id as string);
    return { ...c, toplam: o.length, bagli: o.filter((x) => bagli.has(x)).length };
  });
  const toplam = satir.reduce((a, x) => a + x.toplam, 0), b = satir.reduce((a, x) => a + x.bagli, 0);
  return (
    <PanelKabugu baslik="Veli bağlantıları" panel="dershane" aktif="/dershane/veliler">
      <Metrik deger={`%${toplam ? Math.round((b / toplam) * 100) : 0}`} etiket={`Veli bağlantı oranı (${b}/${toplam})`} renk="#7c5cfa" ikon="♡" />
      <Kart genis baslik="Toplu veli davet kartı" aciklama="Seçtiğiniz sınıfta velisi bağlanmamış her öğrenci için kişiye özel kod üretilir. Kartları yazdırıp öğrenciyle eve gönderin; veli kodla katıldığında çocuğuyla otomatik bağlanır ve veli onayı verilmiş olur.">
        <KayitFormu eylem={veliKodlari} dugme="Kodları üret">
          <select name="sinif" required className="alan">{sl.map((c) => <option key={c.id} value={c.id}>{c.ad} · {c.sube?.ad}</option>)}</select>
        </KayitFormu>
      </Kart>
      <Kart genis baslik="Sınıflara göre">
        <table className="tablo">
          <thead><tr><th>Sınıf</th><th>Bağlı veli</th><th style={{ width: "40%" }} /></tr></thead>
          <tbody>
            {satir.map((x) => (
              <tr key={x.id}><td><b>{x.ad}</b> <span className="soluk">{x.sube?.ad}</span></td><td>{x.bagli} / {x.toplam}</td>
                <td><Cubuk oran={x.toplam ? x.bagli / x.toplam : 0} /></td></tr>
            ))}
          </tbody>
        </table>
      </Kart>
    </PanelKabugu>
  );
}
