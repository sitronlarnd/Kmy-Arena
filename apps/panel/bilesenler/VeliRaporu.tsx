import type { OgrenciDetayi } from "@/lib/tipler";

export interface DenemeSatiri { ad: string; tarih: string; net: number }

/** Veli toplantısı için tek sayfalık öğrenci raporu (yazdırılır). */
export function VeliRaporu({ d, dershane, denemeler }: { d: OgrenciDetayi; dershane: string; denemeler: DenemeSatiri[] }) {
  const son4 = d.gunluk.slice(-28);
  const dk = son4.reduce((a, g) => a + g.dk, 0), soru = son4.reduce((a, g) => a + g.soru, 0), gun = son4.filter((g) => g.soru > 0).length;
  const dogruluk = d.ilerleme?.toplam_cevap ? Math.round((d.ilerleme.toplam_dogru / d.ilerleme.toplam_cevap) * 100) : null;
  return (
    <section className="veli-rapor">
      <header><div><h2>{d.ad}</h2><span>{d.sinif ?? ""} · {d.sube ?? ""}</span></div><div className="sag"><b>{dershane}</b><span>Veli görüşmesi raporu · {new Date().toLocaleDateString("tr-TR")}</span></div></header>
      <div className="vr-kartlar">
        <div><b>{gun}/28</b><span>aktif gün (son 4 hafta)</span></div>
        <div><b>{Math.round(dk / 60)} sa {dk % 60} dk</b><span>çalışma süresi</span></div>
        <div><b>{soru}</b><span>çözülen soru</span></div>
        <div><b>{dogruluk === null ? "—" : `%${dogruluk}`}</b><span>genel doğruluk</span></div>
        <div><b>{d.ilerleme?.seri ?? 0} gün</b><span>güncel seri</span></div>
      </div>
      <div className="vr-iki">
        <div><h3>Güçlü konular</h3><ul>{d.guclu.slice(0, 5).map((k) => <li key={k.kod}>{k.aciklama}</li>)}{d.guclu.length === 0 && <li className="soluk">Henüz yeterli veri yok</li>}</ul></div>
        <div><h3>Çalışılması gereken konular</h3><ul>{d.zayif.slice(0, 5).map((k) => <li key={k.kod}>{k.aciklama}</li>)}{d.zayif.length === 0 && <li className="soluk">Belirgin zayıf konu yok</li>}</ul></div>
      </div>
      <div className="vr-iki">
        <div><h3>Ders bazında gelişim (haftalık doğruluk)</h3>
          <table><tbody>{d.dersler.slice(0, 6).map((x) => {
            const h = x.haftalar.slice(-4);
            return <tr key={x.ders}><td>{x.ders}</td><td>{h.map((w) => `%${w.dogruluk}`).join(" → ") || "—"}</td></tr>;
          })}</tbody></table>
        </div>
        <div><h3>Deneme netleri</h3>
          <table><tbody>{denemeler.slice(-5).map((x) => <tr key={x.ad + x.tarih}><td>{x.ad}</td><td>{new Date(x.tarih).toLocaleDateString("tr-TR")}</td><td><b>{x.net}</b></td></tr>)}
            {denemeler.length === 0 && <tr><td className="soluk">Deneme sonucu yüklenmemiş</td></tr>}</tbody></table>
          <h3 style={{ marginTop: 10 }}>Ödevler</h3>
          <p>{d.odevler.filter((o) => o.bitis).length} / {d.odevler.length} ödev tamamlandı</p>
        </div>
      </div>
      <div className="vr-not"><h3>Öğretmen notu</h3><div /><div /><div /></div>
    </section>
  );
}
