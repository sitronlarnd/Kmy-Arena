import { faturaEkle, faturaOdendi, ucretAyarla } from "@/app/merkez/merkez-eylemleri";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Finans() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.finans");
  const s = servis();
  const [{ data: faturalar }, { data: dershaneler }] = await Promise.all([
    s.from("fatura").select("id, donem, tutar, vade, durum, odeme_tarihi, aciklama, dershane:dershane_id(ad)").order("vade", { ascending: false }).limit(200),
    s.from("dershane").select("id, ad, aylik_ucret, lisans_durumu").eq("bireysel", false).order("ad"),
  ]);
  const bugun = new Date().toISOString().slice(0, 10);
  type F = { id: string; donem: string; tutar: number; vade: string; durum: string; odeme_tarihi: string | null; aciklama: string | null; dershane: { ad: string } | null };
  const l = (faturalar ?? []) as unknown as F[];
  const geciken = l.filter((f) => f.durum === "bekliyor" && f.vade < bugun);
  const mrr = (dershaneler ?? []).filter((d) => ["aktif", "gecikmis"].includes(d.lisans_durumu as string)).reduce((a, d) => a + Number(d.aylik_ucret ?? 0), 0);
  const tl = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ₺`;
  return (
    <PanelKabugu baslik="Faturalar ve ödemeler" panel="merkez" aktif="/merkez/finans" yol="Ödemeler havale/EFT ile elle işaretlenir. Vadesi 15 günü geçen faturada dershane 'gecikmiş' olur ve kurucuya e-posta gider; 30 günde öğrenci uygulaması salt okunur moda geçer (veriler silinmez).">
      <Metrik deger={tl(mrr)} etiket="MRR" renk="#f5a400" ikon="₺" />
      <Metrik deger={geciken.length} etiket={`Geciken fatura · ${tl(geciken.reduce((a, f) => a + Number(f.tutar), 0))}`} renk="#e5354f" ikon="!" />
      <Kart baslik="Fatura kes">
        <KayitFormu eylem={faturaEkle} dugme="Ekle">
          <select name="dershane" required className="alan">{(dershaneler ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.ad as string}</option>)}</select>
          <input name="donem" required placeholder="2026-11" pattern="\d{4}-\d{2}" className="alan" style={{ width: 100 }} />
          <input name="tutar" required type="number" step="0.01" placeholder="Tutar ₺" className="alan" style={{ width: 120 }} />
          <label className="kucuk soluk">Vade <input name="vade" type="date" required className="alan" /></label>
          <input name="aciklama" placeholder="Açıklama" className="alan" />
        </KayitFormu>
      </Kart>
      <Kart baslik="Aylık ücretler (MRR)">
        {(dershaneler ?? []).map((d) => (
          <KayitFormu key={d.id as string} eylem={ucretAyarla} dugme="Kaydet">
            <input type="hidden" name="dershane" value={d.id as string} />
            <span style={{ minWidth: 160 }}><b>{d.ad as string}</b> <span className="rozet">{d.lisans_durumu as string}</span></span>
            <input name="ucret" type="number" step="0.01" defaultValue={(d.aylik_ucret as number | null) ?? ""} placeholder="₺ / ay" className="alan" style={{ width: 120 }} />
          </KayitFormu>
        ))}
      </Kart>
      <Kart genis baslik="Faturalar">
        <table className="tablo"><thead><tr><th>Dershane</th><th>Dönem</th><th>Tutar</th><th>Vade</th><th>Durum</th></tr></thead>
          <tbody>{l.map((f) => (
            <tr key={f.id}><td><b>{f.dershane?.ad}</b><div className="soluk kucuk">{f.aciklama}</div></td><td>{f.donem}</td><td>{tl(Number(f.tutar))}</td><td>{tarih(f.vade)}</td>
              <td>{f.durum === "odendi" ? <span className="rozet dogru">Ödendi {tarih(f.odeme_tarihi)}</span>
                : <div className="form">{f.vade < bugun && <span className="rozet yanlis">{Math.round((Date.parse(bugun) - Date.parse(f.vade)) / 86400000)} gün gecikti</span>}<KayitDugmesi eylem={faturaOdendi.bind(null, f.id)} etiket="Ödendi" /></div>}</td></tr>
          ))}</tbody></table>
      </Kart>
    </PanelKabugu>
  );
}
