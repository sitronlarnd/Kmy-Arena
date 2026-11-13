import { Kart, PanelKabugu, Risk } from "@/bilesenler/PanelKabugu";
import { EylemDugmesi } from "@/bilesenler/Istemci";
import { zayifKonularaOdev } from "@/app/ogretmen/eylemler";
import { onceKac, panelRpc } from "@/lib/panel";
import { paneleErisebilir, yetkilerim } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Analiz {
  sinif: { id: string; ad: string; sinav_turu: string };
  ogrenciler: Array<{ id: string; ad: string; takma_ad: string; son_giris: string | null; soru7: number; dogruluk: number | null; seviye: number; risk: { puan: number; nedenler: string[] } }>;
  kazanimlar: Array<{ id: string; kod: string; aciklama: string; ders: string }>;
  hucreler: Array<[string, string, string, number, number]>;
  zayif: Array<{ kod: string; aciklama: string; ders: string; cozulen: number; yanlis_orani: number; celdiriciler: Array<{ govde: string; sik: string; metin: string; sayi: number }> }>;
}

function hucreSinifi(u: string, oran: number): string {
  if (u === "altin" || u === "gumus" || u === "bronz") return u;
  return oran < 50 ? "zayif" : "bronz";
}

export default async function SinifAnalizi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const y = await yetkilerim();
  const a = await panelRpc<Analiz>("panel_sinif_analiz", { p_sinif: id });
  const hucre = new Map(a.hucreler.map(([o, k, u, oran, n]) => [`${o}|${k}`, { u, oran, n }]));
  const dikkat = a.ogrenciler.filter((o) => o.risk.puan >= 30).sort((x, z) => z.risk.puan - x.risk.puan);
  return (
    <PanelKabugu baslik={a.sinif.ad} panel={paneleErisebilir(y, "ogretmen") ? "ogretmen" : "dershane"} aktif="/ogretmen" yol={<a href="/ogretmen">Sınıflarım</a>}
      sag={<EylemDugmesi eylem={zayifKonularaOdev.bind(null, id, null)} etiket="Zayıf konulara ödev ver" />}>
      <Kart genis baslik="Kazanım ısı haritası" aciklama="Satırlar öğrenciler, sütunlar sınıfın en çok çalıştığı kazanımlar. Hücrenin üzerine gelince doğruluk ve çözülen soru sayısı görünür.">
        <div className="lejant" style={{ margin: "12px 0" }}>
          <span><i className="isi altin" />Altın</span><span><i className="isi gumus" />Gümüş</span><span><i className="isi bronz" />Bronz</span><span><i className="isi zayif" />Zayıf (%50 altı)</span><span><i className="isi bos" />Çalışılmadı</span>
        </div>
        {a.kazanimlar.length === 0 ? <p className="bos">Henüz çözüm verisi yok.</p> : (
          <div className="kaydir">
            <table className="isi-tablo">
              <thead><tr><th style={{ writingMode: "horizontal-tb", transform: "none" }} />{a.kazanimlar.map((k) => <th key={k.id} title={`${k.ders}: ${k.aciklama}`}>{k.kod}</th>)}</tr></thead>
              <tbody>
                {a.ogrenciler.map((o) => (
                  <tr key={o.id}>
                    <td className="ad"><a href={`/ogretmen/ogrenci/${o.id}`}>{o.ad}</a></td>
                    {a.kazanimlar.map((k) => {
                      const h = hucre.get(`${o.id}|${k.id}`);
                      return <td key={k.id}><span className={`isi ${h ? hucreSinifi(h.u, h.oran) : "bos"}`} title={h ? `${k.kod} · %${h.oran} doğru · ${h.n} soru` : `${k.kod} · çalışılmadı`} /></td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kart>

      <Kart baslik="Dikkat listesi" aciklama="Risk sinyali olan öğrenciler — destek odaklı öneriler">
        <div className="liste" style={{ marginTop: 12 }}>
          {dikkat.length === 0 && <p className="bos">Şu an dikkat gerektiren öğrenci yok.</p>}
          {dikkat.map((o) => (
            <a key={o.id} href={`/ogretmen/ogrenci/${o.id}`} className="satir" style={{ color: "inherit", textDecoration: "none" }}>
              <Risk puan={o.risk.puan} />
              <div className="esnek">
                <strong>{o.ad}</strong>
                <div className="soluk kucuk">{o.risk.nedenler.join(" · ")}</div>
              </div>
            </a>
          ))}
        </div>
      </Kart>

      <Kart baslik="En çok yanlış yapılan kazanımlar" aciklama="Son 30 gün · en sık seçilen yanlış şıklar (kavram yanılgısı)">
        <div className="liste" style={{ marginTop: 12 }}>
          {a.zayif.length === 0 && <p className="bos">Yeterli veri yok.</p>}
          {a.zayif.map((z) => (
            <div key={z.kod} className="satir" style={{ alignItems: "flex-start", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
                <span className="rozet yanlis">%{z.yanlis_orani} yanlış</span>
                <strong>{z.kod}</strong>
                <span className="soluk kucuk" style={{ marginLeft: "auto" }}>{z.cozulen} cevap</span>
              </div>
              <div className="kucuk">{z.aciklama}</div>
              {z.celdiriciler.map((c, i) => (
                <div key={i} className="kucuk soluk">↳ {c.sayi} öğrenci <b>{c.sik}</b> şıkkını seçti{c.metin ? `: “${c.metin}”` : ""}</div>
              ))}
            </div>
          ))}
        </div>
      </Kart>

      <Kart genis baslik="Öğrenciler">
        <div className="kaydir">
          <table className="tablo">
            <thead><tr><th>Öğrenci</th><th>Seviye</th><th>Bu hafta</th><th>Doğruluk</th><th>Son giriş</th><th>Risk</th></tr></thead>
            <tbody>
              {a.ogrenciler.map((o) => (
                <tr key={o.id}>
                  <td><a href={`/ogretmen/ogrenci/${o.id}`}>{o.ad}</a><div className="soluk kucuk">{o.takma_ad}</div></td>
                  <td>{o.seviye}</td>
                  <td>{o.soru7} soru</td>
                  <td>{o.dogruluk === null ? "—" : `%${o.dogruluk}`}</td>
                  <td className="soluk">{onceKac(o.son_giris)}</td>
                  <td><Risk puan={o.risk.puan} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
