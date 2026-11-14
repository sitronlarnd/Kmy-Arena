import { Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { onceKac, tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Ozet {
  dershane: number; aktif: number; pilot: number; ogrenci: number; gunluk_aktif: number; haftalik_aktif: number; bugun_soru: number; mrr: number; ai_maliyet_ay: number; fiyatsiz_model: number;
  dershaneler: { id: string; ad: string; sehir: string | null; lisans: string; bitis: string | null; limit: number; ucret: number | null; ogrenci: number; haftalik_aktif: number; soru30: number; maliyet30: number; saglik: number }[];
  akis: { yeni_dershane: { ad: string; olusturma: string }[]; teklif: { ad: string; sehir: string; olusturma: string }[]; sikayet: number; destek: number };
}
const tl = (n: number) => n.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
const usd = (n: number) => `$${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;

export default async function Merkez() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.dershane_yonet").catch(() => merkezYetkisi("merkez.destek"));
  const { data } = await servis().rpc("sistem_merkez_ozet");
  const o = data as Ozet;
  const kur = Number(process.env.USD_TL_KURU ?? 0);
  const maliyetTl = kur ? o.ai_maliyet_ay * kur : null;
  return (
    <PanelKabugu baslik="Genel bakış" panel="merkez" aktif="/merkez">
      <Metrik deger={`${o.aktif} / ${o.dershane}`} etiket={`Aktif dershane · ${o.pilot} pilot`} renk="#7c5cfa" ikon="▦" />
      <Metrik deger={tl(o.ogrenci)} etiket={`Öğrenci · günlük ${tl(o.gunluk_aktif)} / haftalık ${tl(o.haftalik_aktif)} aktif`} renk="#3fa9f5" ikon="☺" />
      <Metrik deger={tl(o.bugun_soru)} etiket="Bugün çözülen soru" renk="#12b76a" ikon="✓" />
      <Metrik deger={`${tl(o.mrr)} ₺`} etiket="Aylık yinelenen gelir (MRR)" renk="#f5a400" ikon="₺" />
      <Metrik deger={usd(o.ai_maliyet_ay)} etiket={`Bu ay KMYAI maliyeti${o.fiyatsiz_model ? ` · ${o.fiyatsiz_model} modelin fiyatı girilmemiş` : ""}`} renk="#ff6a3d" ikon="✦" />
      <Metrik deger={maliyetTl === null ? "—" : `%${o.mrr ? Math.round(((o.mrr - maliyetTl) / o.mrr) * 100) : 0}`} etiket={maliyetTl === null ? "Brüt marj (USD_TL_KURU tanımlayın)" : "Brüt marj (MRR − AI maliyeti)"} renk="#12b76a" ikon="↗" />
      <Kart genis baslik="Dershaneler" aciklama="Sağlık skoru: aktiflik, öğretmen kullanımı, ödeme durumu, destek talepleri ve lisans bitişinden hesaplanır; 50 altı kaybetme riski.">
        <div className="kaydir">
          <table className="tablo">
            <thead><tr><th>Dershane</th><th>Öğrenci / limit</th><th>Haftalık aktif</th><th>Öğrenci başı soru (30 g)</th><th>AI maliyeti (30 g)</th><th>Aylık gelir</th><th>Lisans</th><th>Sağlık</th><th /></tr></thead>
            <tbody>{o.dershaneler.map((d) => (
              <tr key={d.id}>
                <td><b>{d.ad}</b><div className="soluk kucuk">{d.sehir}</div></td>
                <td>{d.ogrenci} / {d.limit}</td>
                <td>%{d.ogrenci ? Math.round((d.haftalik_aktif / d.ogrenci) * 100) : 0}</td>
                <td>{d.ogrenci ? Math.round(d.soru30 / d.ogrenci) : 0}</td>
                <td>{usd(Number(d.maliyet30))}</td>
                <td>{d.ucret ? `${tl(d.ucret)} ₺` : "—"}</td>
                <td><span className="rozet">{d.lisans}</span><div className="soluk kucuk">{tarih(d.bitis)}</div></td>
                <td><span className={`rozet ${d.saglik >= 70 ? "dogru" : d.saglik >= 50 ? "altin" : "yanlis"}`}>{d.saglik}{d.saglik < 50 ? " · risk" : ""}</span></td>
                <td><a href={`/merkez/dershaneler/${d.id}/goruntule`}>Görüntüle</a></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Kart>
      <Kart baslik="Son açılan dershaneler">{o.akis.yeni_dershane.map((x) => <p key={x.ad + x.olusturma}>{x.ad} · <span className="soluk">{onceKac(x.olusturma)}</span></p>)}</Kart>
      <Kart baslik="Gelen teklifler">{o.akis.teklif.map((x) => <p key={x.ad + x.olusturma}>{x.ad} ({x.sehir}) · <span className="soluk">{onceKac(x.olusturma)}</span></p>)}<p><a href="/merkez/teklifler">Tümü →</a></p></Kart>
      <Kart baslik="Bekleyenler"><p><a href="/merkez/moderasyon">{o.akis.sikayet} merkeze iletilen şikâyet</a></p><p><a href="/merkez/destek">{o.akis.destek} açık destek talebi</a></p><p><a href="/merkez/sistem">Sistem sağlığı →</a></p></Kart>
    </PanelKabugu>
  );
}
