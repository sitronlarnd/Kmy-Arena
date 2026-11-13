import { CizgiGrafik, Cubuk, Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc, tarih } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Ozet {
  ogrenci: number; limit: number | null; lisans: { durum: string; bitis: string | null };
  aktif_bugun: number; aktif_hafta: number; soru_hafta: number; dk_hafta: number | null; aktif_ogretmen: number; ogretmen: number;
  bekleyen_odev: number; riskli: number;
  trend: Array<{ hafta: string; soru: number; aktif: number }>;
  subeler: Array<{ ad: string; ogrenci: number; aktif: number; soru: number; dogruluk: number | null }>;
  gelisenler: Array<{ id: string; ad: string; soru: number; artis: number }>;
  aktif_sinif: { ad: string; soru: number } | null;
  klan_savaslari: Array<{ a: string; b: string; kazanan: string | null; durum: string }>;
}

export default async function Dershane() {
  await paneliKoru("dershane");
  const s = await sunucuIstemcisi();
  const [o, { data: d }] = await Promise.all([panelRpc<Ozet>("panel_dershane_ozet"), s.from("dershane").select("ad").single()]);
  const yuzde = (n: number) => (o.ogrenci ? Math.round((n / o.ogrenci) * 100) : 0);
  return (
    <PanelKabugu baslik={d?.ad ?? "Dershane"} panel="dershane" aktif="/dershane" yol="Genel bakış">
      <Metrik deger={`%${yuzde(o.aktif_bugun)}`} etiket={`Bugün aktif · ${o.aktif_bugun} öğrenci`} renk="#12b76a" ikon="●" />
      <Metrik deger={`%${yuzde(o.aktif_hafta)}`} etiket={`Bu hafta aktif · ${o.aktif_hafta}/${o.ogrenci}`} renk="#7c5cfa" ikon="↗" />
      <Metrik deger={o.soru_hafta.toLocaleString("tr-TR")} etiket={`Çözülen soru · öğrenci başı ${o.aktif_hafta ? Math.round((o.dk_hafta ?? 0) / o.aktif_hafta) : 0} dk`} renk="#3fa9f5" ikon="✓" />
      <Metrik deger={`${o.aktif_ogretmen}/${o.ogretmen}`} etiket="Bu hafta aktif öğretmen" renk="#ff6a3d" ikon="✦" />
      <Metrik deger={o.bekleyen_odev} etiket="Bekleyen ödev ataması" renk="#f5a400" ikon="✎" />
      <a href="/dershane/rehberlik" className="kart tik"><div className="metrik"><div className="ikon" style={{ background: "#e5354f22", color: "#e5354f" }}>!</div><div><strong>{o.riskli}</strong><span>Riskli öğrenci → rehberlik</span></div></div></a>

      <Kart genis baslik="Son 8 hafta — çözülen soru">
        <CizgiGrafik veri={o.trend.map((x) => x.soru)} etiketler={o.trend.map((x) => tarih(x.hafta))} />
      </Kart>

      <Kart baslik="Şubeler (bu hafta)">
        <div className="liste" style={{ marginTop: 12 }}>
          {o.subeler.map((x) => (
            <div key={x.ad} className="satir" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><b>{x.ad}</b><span className="soluk kucuk">{x.soru} soru · %{x.dogruluk ?? 0} doğru</span></div>
              <Cubuk oran={x.ogrenci ? x.aktif / x.ogrenci : 0} />
              <span className="soluk kucuk">{x.aktif}/{x.ogrenci} aktif</span>
            </div>
          ))}
        </div>
      </Kart>

      <Kart baslik="Haftanın öne çıkanları">
        <div className="liste" style={{ marginTop: 12 }}>
          {o.aktif_sinif && <div className="satir"><span className="rozet altin">En aktif sınıf</span><div className="esnek"><b>{o.aktif_sinif.ad}</b></div><span className="soluk kucuk">{o.aktif_sinif.soru} soru</span></div>}
          {o.gelisenler.map((g, i) => (
            <a key={g.id} href={`/ogretmen/ogrenci/${g.id}`} className="satir" style={{ color: "inherit", textDecoration: "none" }}>
              <span className="rozet dogru">#{i + 1} gelişen</span><div className="esnek"><b>{g.ad}</b></div><span className="soluk kucuk">{g.soru} soru</span>
            </a>
          ))}
          {o.klan_savaslari.map((k, i) => (
            <div key={i} className="satir"><span className="rozet vurgu">Klan savaşı</span><div className="esnek kucuk">{k.a} – {k.b}</div><b className="kucuk">{k.durum === "bitti" ? (k.kazanan ? `Kazanan: ${k.kazanan}` : "Berabere") : "Sürüyor"}</b></div>
          ))}
          {!o.aktif_sinif && o.gelisenler.length === 0 && o.klan_savaslari.length === 0 && <p className="bos">Bu hafta henüz veri yok.</p>}
        </div>
      </Kart>

      <Kart baslik="Lisans">
        <div className="liste" style={{ marginTop: 12 }}>
          <div className="satir"><div className="esnek">Durum</div><span className="rozet vurgu">{o.lisans.durum}</span></div>
          <div className="satir"><div className="esnek">Koltuk</div><b>{o.ogrenci} / {o.limit ?? "∞"}</b></div>
          <Cubuk oran={o.limit ? o.ogrenci / o.limit : 0} />
          <div className="satir"><div className="esnek">Bitiş</div><b>{o.lisans.bitis ? tarih(o.lisans.bitis) : "—"}</b></div>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
