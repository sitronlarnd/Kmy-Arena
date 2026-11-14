import { merkezDuyuru, sablonKaydet } from "@/app/merkez/merkez-eylemleri";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Duyuru() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.destek");
  const s = servis();
  const [{ data: duyurular }, { data: dershaneler }, { data: sablonlar }] = await Promise.all([
    s.from("merkez_duyuru").select("*").order("olusturma", { ascending: false }).limit(20),
    s.from("dershane").select("id, ad").eq("bireysel", false).order("ad"),
    s.from("eposta_sablon").select("*").order("kod"),
  ]);
  const ad = new Map((dershaneler ?? []).map((d) => [d.id as string, d.ad as string]));
  return (
    <PanelKabugu baslik="Duyurular ve e-posta şablonları" panel="merkez" aktif="/merkez/duyuru" yol="Uygulama içi (öğrenci) bakım/yenilik duyurusu Sistem sayfasından yapılır.">
      <Kart genis baslik="Dershanelere duyuru" aciklama="Seçilen dershanelerin (boşsa tümünün) panelinde bant olarak görünür.">
        <KayitFormu eylem={merkezDuyuru} dugme="Yayınla">
          <input name="baslik" required placeholder="Başlık" className="alan" />
          <input name="metin" required placeholder="Metin" className="alan" style={{ minWidth: 320, flex: 1 }} />
          <label className="kucuk soluk">Bitiş <input name="bitis" type="date" className="alan" /></label>
          <select name="dershane" multiple className="alan" style={{ minHeight: 70 }}>{(dershaneler ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.ad as string}</option>)}</select>
        </KayitFormu>
        <table className="tablo" style={{ marginTop: 10 }}><tbody>{(duyurular ?? []).map((d) => (
          <tr key={d.id as string}><td><b>{d.baslik as string}</b><div className="kucuk soluk">{d.metin as string}</div></td><td className="kucuk">{(d.dershane_ids as string[] | null)?.map((x) => ad.get(x)).join(", ") ?? "Tümü"}</td><td>{tarih(d.olusturma as string)}{d.bitis ? ` – ${tarih(d.bitis as string)}` : ""}</td></tr>
        ))}</tbody></table>
      </Kart>
      {(sablonlar ?? []).map((t) => (
        <Kart key={t.kod as string} genis baslik={`Şablon: ${t.kod as string}`} aciklama={`${(t.aciklama as string) ?? ""} · Yer tutucular: {ad}, {dershane}… süslü parantezle`}>
          <KayitFormu eylem={sablonKaydet} dugme="Kaydet">
            <input type="hidden" name="kod" value={t.kod as string} />
            <input name="konu" defaultValue={t.konu as string} className="alan" style={{ width: "100%" }} />
            <textarea name="govde" defaultValue={t.govde as string} rows={6} className="alan" style={{ width: "100%", fontFamily: "ui-monospace, monospace" }} />
          </KayitFormu>
        </Kart>
      ))}
    </PanelKabugu>
  );
}
