import { sinifArsiv, sinifKaydet, subeKaydet } from "@/app/dershane/kayit/eylemler";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

const SINAV: Record<string, string> = { LGS: "LGS", TYT: "YKS (TYT/AYT)", AYT: "YKS (yalnız AYT)", YDT: "YDT" };

export default async function Yapi() {
  await paneliKoru("dershane");
  const k = await yetkiIste("sinif.yonet");
  const s = servis();
  const [{ data: subeler }, { data: siniflar }, { data: uyelik }] = await Promise.all([
    s.from("sube").select("id, ad, sehir").eq("dershane_id", k.dershaneId).order("ad"),
    s.from("sinif").select("id, ad, sube_id, sinav_turu, seviye, yks_alani, arsiv").eq("dershane_id", k.dershaneId).order("seviye").order("ad"),
    s.from("sinif_uyelik").select("sinif_id, rol").eq("dershane_id", k.dershaneId),
  ]);
  const gorunur = (subeId: string) => k.tum || k.subeler.includes(subeId);
  const sayi = (sinif: string, rol: string) => (uyelik ?? []).filter((u) => u.sinif_id === sinif && u.rol === rol).length;
  const sl = (subeler ?? []).filter((x) => gorunur(x.id as string));
  return (
    <PanelKabugu baslik="Şubeler ve sınıflar" panel="dershane" aktif="/dershane/yapi">
      {k.tum && (
        <Kart baslik="Şube ekle">
          <KayitFormu eylem={subeKaydet} dugme="Ekle">
            <input name="ad" placeholder="Şube adı (ör. Kadıköy)" required className="alan" />
            <input name="sehir" placeholder="Şehir" className="alan" />
          </KayitFormu>
        </Kart>
      )}
      <Kart baslik="Sınıf ekle" aciklama="YKS sınıflarında alan (SAY/EA/SÖZ/DİL) öğrencinin göreceği AYT derslerini belirler.">
        <KayitFormu eylem={sinifKaydet} dugme="Ekle">
          <select name="sube" required className="alan">{sl.map((x) => <option key={x.id as string} value={x.id as string}>{x.ad as string}</option>)}</select>
          <input name="ad" placeholder="Sınıf adı (ör. 8-A)" required className="alan" style={{ width: 120 }} />
          <select name="sinav" className="alan">{Object.entries(SINAV).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
          <select name="seviye" className="alan" defaultValue="8">{[5, 6, 7, 8, 9, 10, 11, 12, 13].map((x) => <option key={x} value={x}>{x === 13 ? "Mezun" : `${x}. sınıf`}</option>)}</select>
          <select name="alan" className="alan" defaultValue=""><option value="">Alan (YKS)</option><option>SAY</option><option>EA</option><option value="SOZ">SÖZ</option><option value="DIL">DİL</option></select>
        </KayitFormu>
      </Kart>
      {sl.map((sb) => {
        const l = (siniflar ?? []).filter((c) => c.sube_id === sb.id);
        return (
          <Kart key={sb.id as string} genis baslik={`${sb.ad as string}${sb.sehir ? ` · ${sb.sehir as string}` : ""}`} aciklama={`${l.filter((c) => !c.arsiv).length} aktif sınıf`}>
            {k.tum && (
              <details className="kucuk" style={{ margin: "8px 0" }}><summary>Şubeyi yeniden adlandır</summary>
                <KayitFormu eylem={subeKaydet} dugme="Kaydet">
                  <input type="hidden" name="id" value={sb.id as string} />
                  <input name="ad" defaultValue={sb.ad as string} className="alan" required />
                  <input name="sehir" defaultValue={(sb.sehir as string) ?? ""} className="alan" />
                </KayitFormu>
              </details>
            )}
            <div className="kaydir">
              <table className="tablo">
                <thead><tr><th>Sınıf</th><th>Sınav</th><th>Seviye</th><th>Öğrenci</th><th>Öğretmen</th><th /></tr></thead>
                <tbody>
                  {l.length === 0 && <tr><td colSpan={6} className="bos">Henüz sınıf yok.</td></tr>}
                  {l.map((c) => (
                    <tr key={c.id as string} style={c.arsiv ? { opacity: 0.5 } : undefined}>
                      <td><b>{c.ad as string}</b>{c.arsiv ? <span className="rozet" style={{ marginLeft: 6 }}>arşiv</span> : null}</td>
                      <td>{SINAV[c.sinav_turu as string]}{c.yks_alani ? ` · ${c.yks_alani as string}` : ""}</td>
                      <td>{c.seviye === 13 ? "Mezun" : `${c.seviye as number}. sınıf`}</td>
                      <td>{sayi(c.id as string, "ogrenci")}</td>
                      <td>{sayi(c.id as string, "ogretmen")}</td>
                      <td>
                        {c.arsiv
                          ? <KayitDugmesi eylem={sinifArsiv.bind(null, c.id as string, false)} etiket="Arşivden çıkar" tur="ikincil" />
                          : <KayitDugmesi eylem={sinifArsiv.bind(null, c.id as string, true)} etiket={sayi(c.id as string, "ogrenci") ? "Arşivle" : "Sil"} tur="ikincil" onay="Emin misin?" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kart>
        );
      })}
    </PanelKabugu>
  );
}
