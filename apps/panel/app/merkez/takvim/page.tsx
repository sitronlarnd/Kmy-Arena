import { takvimEkle, takvimSil } from "@/app/merkez/merkez-eylemleri";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
const TUR: Record<string, string> = { cift_xp: "Çift XP", tema: "Tematik hafta", sezon: "Sezon", turnuva: "Dershaneler arası turnuva" };

export default async function Takvim() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.ekonomi_yonet");
  const s = servis();
  const [{ data }, { data: dershaneler }] = await Promise.all([s.from("platform_etkinlik").select("*").order("baslangic", { ascending: false }).limit(50), s.from("dershane").select("id, ad").eq("bireysel", false).order("ad")]);
  const ad = new Map((dershaneler ?? []).map((d) => [d.id as string, d.ad as string]));
  return (
    <PanelKabugu baslik="Etkinlik takvimi" panel="merkez" aktif="/merkez/takvim">
      <Kart genis baslik="Planla" aciklama="Çift XP hafta sonu: seçilen aralıkta kazanılan XP çarpanla çarpılır (ödül sunucuda hesaplanır, uygulama güncellemesi gerekmez). Dershane seçmezseniz tüm dershanelere uygulanır.">
        <KayitFormu eylem={takvimEkle} dugme="Ekle">
          <input name="ad" required placeholder="Ad (ör. Kasım çift XP hafta sonu)" className="alan" />
          <select name="tur" className="alan">{Object.entries(TUR).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
          <label className="kucuk soluk">Başlangıç <input name="baslangic" type="datetime-local" required className="alan" /></label>
          <label className="kucuk soluk">Bitiş <input name="bitis" type="datetime-local" required className="alan" /></label>
          <label className="kucuk soluk">XP çarpanı <input name="carpan" type="number" step="0.5" min={1} max={3} defaultValue={2} className="alan" style={{ width: 80 }} /></label>
          <select name="dershane" multiple className="alan" style={{ minHeight: 80 }}>{(dershaneler ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.ad as string}</option>)}</select>
          <input name="aciklama" placeholder="Açıklama" className="alan" />
        </KayitFormu>
      </Kart>
      <Kart genis>
        <table className="tablo"><thead><tr><th>Etkinlik</th><th>Tür</th><th>Tarih</th><th>Kapsam</th><th /></tr></thead>
          <tbody>{(data ?? []).map((e) => {
            const simdi = Date.now(), b = Date.parse(e.baslangic as string), t = Date.parse(e.bitis as string);
            return (
              <tr key={e.id as string}><td><b>{e.ad as string}</b>{simdi >= b && simdi <= t && <span className="rozet dogru" style={{ marginLeft: 6 }}>şu an</span>}</td>
                <td>{TUR[e.tur as string]}{e.tur === "cift_xp" ? ` ×${e.xp_carpan as number}` : ""}</td><td>{tarih(e.baslangic as string, true)} – {tarih(e.bitis as string, true)}</td>
                <td className="kucuk">{(e.dershane_ids as string[] | null)?.map((x) => ad.get(x)).join(", ") ?? "Tümü"}</td>
                <td><KayitDugmesi eylem={takvimSil.bind(null, e.id as string)} etiket="Sil" tur="ikincil" onay="Emin misin?" /></td></tr>
            );
          })}</tbody></table>
      </Kart>
    </PanelKabugu>
  );
}
