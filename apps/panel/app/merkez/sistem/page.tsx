import { modelFiyat, sistemKaydet } from "@/app/merkez/merkez-eylemleri";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Saglik { aktif_duello: number; esz_kullanici: number; saatlik_cevap: number; ai_istek_24s: number; ai_hata_orani: number | null; ai_p50_ms: number | null; ai_p95_ms: number | null; bildirim_bekleyen: number; havuz_dogrulanmis: number; havuz_24s_uretim: number; havuz_24s_red: number; veritabani_mb: number; acik_sikayet: number; acik_destek: number }
interface Etki { ogrenci: number; dershane: number; gruplar: { grup: string; ogrenci: number; gunluk_soru: number; degisim: number }[] }

export default async function Sistem() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.sistem");
  const s = servis();
  const [{ data: sg }, { data: ua }, { data: fiyatlar }, { data: etki }, { data: modeller }] = await Promise.all([
    s.rpc("sistem_saglik"), s.from("uygulama_ayari").select("*").single(), s.from("model_fiyat").select("*").order("model"),
    s.rpc("sistem_platform_etki", { p_sinav: "LGS" }),
    s.from("ai_cagri_log").select("model").gte("olusturma", new Date(Date.now() - 30 * 86400000).toISOString()).limit(5000),
  ]);
  const h = sg as Saglik;
  const e = etki as Etki;
  const kullanilan = [...new Set((modeller ?? []).map((x) => x.model as string))];
  const fl = new Map((fiyatlar ?? []).map((x) => [x.model as string, x]));
  const tumModeller = [...new Set([...kullanilan, ...fl.keys()])].sort();
  return (
    <PanelKabugu baslik="Sistem ve sürüm" panel="merkez" aktif="/merkez/sistem">
      <Metrik deger={h.esz_kullanici} etiket={`Son 5 dk aktif öğrenci · ${h.aktif_duello} süren düello`} renk="#7c5cfa" ikon="◉" />
      <Metrik deger={h.saatlik_cevap} etiket="Son 1 saatte cevap" renk="#12b76a" ikon="✓" />
      <Metrik deger={`%${h.ai_hata_orani ?? 0}`} etiket={`AI hata oranı (24 s) · ${h.ai_istek_24s} istek · p50 ${Math.round(h.ai_p50_ms ?? 0)} ms · p95 ${Math.round(h.ai_p95_ms ?? 0)} ms`} renk="#ff6a3d" ikon="✦" />
      <Metrik deger={h.havuz_dogrulanmis.toLocaleString("tr-TR")} etiket={`Doğrulanmış soru · 24 s: ${h.havuz_24s_uretim} üretim, ${h.havuz_24s_red} ret`} renk="#3fa9f5" ikon="▤" />
      <Metrik deger={`${h.veritabani_mb} MB`} etiket={`Veritabanı · ${h.bildirim_bekleyen} bildirim kuyrukta`} renk="#f5a400" ikon="▦" />
      <Metrik deger={h.acik_sikayet + h.acik_destek} etiket={`${h.acik_sikayet} açık şikâyet · ${h.acik_destek} destek`} renk="#e5354f" ikon="!" />
      <Kart baslik="Uygulama sürümü ve bakım" aciklama="En düşük sürümün altındaki uygulamalar “güncelleme zorunlu” ekranı gösterir. Bakım modu öğrenci uygulamasını kapatır ve mesajı gösterir. Duyuru, uygulamanın üstünde bant olarak görünür.">
        <KayitFormu eylem={sistemKaydet} dugme="Kaydet">
          <label className="kucuk soluk">En düşük sürüm <input name="min_surum" defaultValue={ua?.min_surum as string} className="alan" style={{ width: 100 }} /></label>
          <label className="kucuk soluk" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="bakim" defaultChecked={Boolean(ua?.bakim_modu)} /> Bakım modu</label>
          <input name="bakim_mesaji" defaultValue={(ua?.bakim_mesaji as string) ?? ""} placeholder="Bakım mesajı" className="alan" style={{ width: "100%" }} />
          <input name="duyuru" defaultValue={(ua?.duyuru as string) ?? ""} placeholder="Uygulama içi duyuru (boş = yok)" className="alan" style={{ width: "100%" }} />
        </KayitFormu>
      </Kart>
      <Kart baslik="Model fiyatları (maliyet hesabı)" aciklama="KMYAI fiyat listenizden 1 milyon token başına USD. Genel bakıştaki maliyet ve marj bu değerlerle hesaplanır.">
        {tumModeller.map((mdl) => (
          <KayitFormu key={mdl} eylem={modelFiyat} dugme="Kaydet">
            <input type="hidden" name="model" value={mdl} />
            <code style={{ minWidth: 150 }}>{mdl}</code>
            <input name="giris" type="number" step="0.0001" defaultValue={(fl.get(mdl)?.giris_1m as number) ?? 0} className="alan" style={{ width: 100 }} title="Giriş $/1M" />
            <input name="cikis" type="number" step="0.0001" defaultValue={(fl.get(mdl)?.cikis_1m as number) ?? 0} className="alan" style={{ width: 100 }} title="Çıkış $/1M" />
          </KayitFormu>
        ))}
      </Kart>
      <Kart baslik="Yedekler">
        <p>Veritabanı yedekleri Supabase tarafından günlük alınır (Supabase panosu › Database › Backups). Geri yükleme testi için yeni bir Supabase projesine yedekten geri yükleyip <code>pnpm db:test</code> benzeri doğrulama önerilir.</p>
      </Kart>
      <Kart genis baslik="Platform geneli etki (LGS, anonim)" aciklama="Dershane adları gizli; satış materyali için. Kullanım yoğunluğuna göre gruplanmış öğrencilerin ilk → son deneme net değişimi.">
        {e.ogrenci < 3 ? <p>Yeterli deneme verisi yok.</p> : (
          <table className="tablo"><tbody><tr><td colSpan={3} className="soluk">{e.ogrenci} öğrenci · {e.dershane} dershane</td></tr>
            {e.gruplar.map((g) => <tr key={g.grup}><td><b>{{ yuksek: "Yüksek", orta: "Orta", dusuk: "Düşük" }[g.grup] ?? g.grup} kullanım</b></td><td>{g.ogrenci} öğrenci · günde {g.gunluk_soru} soru</td><td><b>{g.degisim >= 0 ? "+" : ""}{g.degisim} net</b></td></tr>)}
          </tbody></table>
        )}
      </Kart>
    </PanelKabugu>
  );
}
