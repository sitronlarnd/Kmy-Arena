import { t } from "@kmy/shared/i18n";
import { PanelKabugu } from "@/bilesenler/PanelKabugu";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { dershaneBayragi, genelBayrak } from "./eylemler";

export const dynamic = "force-dynamic";

const ACIKLAMA: Record<string, string> = {
  duello: "Düello sekmesi ve davetleri",
  klan_savasi: "Klanlar ve klan savaşı",
  topluluk: "Topluluk soru-cevap",
  fotograftan_coz: "Fotoğraftan soru çözme",
  dershaneler_arasi_lig: "Dershaneler arası lig",
  canli_soru_saati: "Canlı Soru Saati",
  asistan: "AI çözüm asistanı",
  veli_raporu: "Veli haftalık raporu",
  klan_sohbeti_serbest: "Klan sohbetinde serbest metin",
};

/**
 * Özellik bayrakları. Öncelik: dershane kaydı > paket > genel (yüzde ile).
 * Bir bayrak kapatılınca özellik o dershanenin uygulamasından ve panelinden kalkar
 * (uygulama açılışta ve oturum yenilemede `ozelliklerim()` okur).
 */
export default async function Bayraklar({ searchParams }: { searchParams: Promise<{ dershane?: string }> }) {
  await paneliKoru("merkez");
  const { dershane } = await searchParams;
  const s = servis();
  const [bayraklar, dershaneler] = await Promise.all([
    s.from("ozellik_bayragi").select("kod, dershane_id, acik, yuzde").order("kod"),
    s.from("dershane").select("id, ad").order("ad"),
  ]);
  const genel = (bayraklar.data ?? []).filter((b) => b.dershane_id === null);
  const secili = dershane ?? dershaneler.data?.[0]?.id;
  const ozel = new Map((bayraklar.data ?? []).filter((b) => b.dershane_id === secili).map((b) => [b.kod as string, b.acik as boolean]));

  return (
    <PanelKabugu baslik={`${t("panel.merkez")} · Özellik bayrakları`}>
      <p className="yol tam"><a href="/merkez">Merkez</a> / Özellik bayrakları</p>
      <section className="kart tam">
        <h3>Genel (tüm dershaneler)</h3>
        <p>Yüzde: kademeli açılış; dershaneler sabit bir kovaya düşer, yüzde arttıkça daha fazlası görür.</p>
        <table className="tablo" style={{ marginTop: 12 }}>
          <thead><tr><th>Özellik</th><th>Açık</th><th>Yüzde</th><th /></tr></thead>
          <tbody>
            {genel.map((b) => (
              <tr key={b.kod}>
                <td>
                  <form id={`g-${b.kod}`} action={genelBayrak}><input type="hidden" name="kod" value={b.kod} /></form>
                  {ACIKLAMA[b.kod] ?? b.kod} <span className="rozet">{b.kod}</span>
                </td>
                <td><input form={`g-${b.kod}`} type="checkbox" name="acik" defaultChecked={b.acik} /></td>
                <td><input form={`g-${b.kod}`} type="number" name="yuzde" min={0} max={100} defaultValue={b.yuzde} /></td>
                <td><button form={`g-${b.kod}`} className="dugme">Kaydet</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="kart tam">
        <h3>Dershane bazında</h3>
        <form className="form" style={{ marginTop: 8 }}>
          <select name="dershane" defaultValue={secili}>
            {(dershaneler.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.ad}</option>
            ))}
          </select>
          <button className="dugme ikincil">Seç</button>
        </form>
        {secili && (
          <table className="tablo" style={{ marginTop: 12 }}>
            <thead><tr><th>Özellik</th><th>Bu dershane için</th><th /></tr></thead>
            <tbody>
              {genel.map((b) => {
                const deger = ozel.has(b.kod) ? (ozel.get(b.kod) ? "acik" : "kapali") : "varsayilan";
                return (
                  <tr key={b.kod}>
                    <td>{ACIKLAMA[b.kod] ?? b.kod}</td>
                    <td>
                      <form id={`d-${b.kod}`} action={dershaneBayragi}>
                        <input type="hidden" name="kod" value={b.kod} />
                        <input type="hidden" name="dershane_id" value={secili} />
                      </form>
                      <select form={`d-${b.kod}`} name="deger" defaultValue={deger}>
                        <option value="varsayilan">Varsayılan (paket/genel)</option>
                        <option value="acik">Açık</option>
                        <option value="kapali">Kapalı</option>
                      </select>
                    </td>
                    <td><button form={`d-${b.kod}`} className="dugme">Kaydet</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </PanelKabugu>
  );
}
