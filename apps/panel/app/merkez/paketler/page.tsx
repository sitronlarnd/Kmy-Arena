import { dershanePaket, paketKaydet } from "@/app/merkez/merkez-eylemleri";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
const OZ: Record<string, string> = { duello: "Düello", klan_savasi: "Klan savaşı", topluluk: "Topluluk", fotograftan_coz: "Fotoğraftan çöz", dershaneler_arasi_lig: "Dershaneler arası lig", canli_soru_saati: "Canlı Soru Saati", asistan: "Asistan", veli_raporu: "Veli raporu" };

export default async function Paketler() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.dershane_yonet");
  const s = servis();
  const [{ data: paketler }, { data: dershaneler }] = await Promise.all([s.from("paket").select("*").order("ad"), s.from("dershane").select("id, ad, paket_id").eq("bireysel", false).order("ad")]);
  const formu = (p?: Record<string, unknown>) => {
    const oz = (p?.ozellikler as Record<string, boolean> | undefined) ?? {};
    return (
      <KayitFormu eylem={paketKaydet} dugme={p ? "Kaydet" : "Paket ekle"}>
        {p ? <input type="hidden" name="id" value={p.id as string} /> : <input name="kod" required placeholder="kod (ör. premium)" className="alan" style={{ width: 120 }} />}
        <input name="ad" required defaultValue={(p?.ad as string) ?? ""} placeholder="Ad" className="alan" style={{ width: 120 }} />
        <label className="kucuk soluk">AI kotası (token/ay) <input name="kota" type="number" defaultValue={(p?.ai_kotasi_token as number) ?? 20000000} className="alan" style={{ width: 130 }} /></label>
        <label className="kucuk soluk">Öğrenci başı ₺ <input name="fiyat" type="number" step="0.01" defaultValue={(p?.ogrenci_basi_fiyat as number | null) ?? ""} className="alan" style={{ width: 90 }} /></label>
        <div className="form kucuk">{Object.entries(OZ).map(([k, a]) => (
          <label key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name={oz[k] === false ? "kapali" : "ozellik"} value={k} defaultChecked={oz[k] !== false} />{a}</label>
        ))}</div>
      </KayitFormu>
    );
  };
  return (
    <PanelKabugu baslik="Paketler" panel="merkez" aktif="/merkez/paketler" yol="Her paket bir özellik seti ve AI kotası içerir. Dershaneye özel istisnalar Özellik bayrakları sayfasından tanımlanır.">
      {(paketler ?? []).map((p) => <Kart key={p.id as string} genis baslik={`${p.ad as string} (${p.kod as string})`}>{formu(p)}</Kart>)}
      <Kart genis baslik="Yeni paket">{formu()}</Kart>
      <Kart genis baslik="Dershane paketleri">
        {(dershaneler ?? []).map((d) => (
          <KayitFormu key={d.id as string} eylem={dershanePaket} dugme="Kaydet">
            <input type="hidden" name="dershane" value={d.id as string} />
            <b style={{ minWidth: 180 }}>{d.ad as string}</b>
            <select name="paket" defaultValue={(d.paket_id as string) ?? ""} className="alan">{(paketler ?? []).map((p) => <option key={p.id as string} value={p.id as string}>{p.ad as string}</option>)}</select>
          </KayitFormu>
        ))}
      </Kart>
    </PanelKabugu>
  );
}
