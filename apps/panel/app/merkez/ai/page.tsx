import { AI_GOREVLERI, SORU_DOGRULAMA_VARSAYILAN, SORU_URETIM_VARSAYILAN } from "@kmy/ai";
import { PanelKabugu } from "@/bilesenler/PanelKabugu";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { acilDurum, ayarGeriAl, ayarYayinla } from "./eylemler";
import { OnIsitma } from "./OnIsitma";

export const dynamic = "force-dynamic";

const GOREV_ADI: Record<string, string> = {
  soru_uretim: "Soru üretimi",
  soru_dogrulama: "Soru doğrulama",
  asistan: "Çözüm asistanı (Sokratik)",
  gorsel_okuma: "Fotoğraftan soru okuma",
  topluluk_degerlendirme: "Topluluk cevap ön değerlendirmesi",
  moderasyon: "İçerik moderasyonu",
  veli_raporu: "Veli haftalık raporu",
  ogretmen_soru_uretim: "Öğretmen için soru ürettirme",
};

interface Ayar {
  gorev: string;
  surum: number;
  durum: string;
  model_birincil: string;
  model_yedek: string | null;
  sicaklik: number | null;
  max_token: number | null;
  zaman_asimi_ms: number | null;
  yeniden_deneme: number | null;
  yayin_tarihi: string | null;
}

function isiRengi(n: number): string {
  if (n >= 8) return "#1e8e5a33";
  if (n >= 3) return "#d4a01733";
  return "#c6282833";
}

export default async function AiMerkezi() {
  await paneliKoru("merkez");
  const s = servis();
  const yediGun = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [ayarlar, uygulama, havuz, kazanimlar, dersler, tuketim, sorular, promptlar] = await Promise.all([
    s.from("ai_gorev_ayari").select("gorev, surum, durum, model_birincil, model_yedek, sicaklik, max_token, zaman_asimi_ms, yeniden_deneme, yayin_tarihi").eq("kapsam", "genel").order("surum", { ascending: false }),
    s.from("uygulama_ayari").select("ai_yedek_mod, durdurulan_ai_gorevleri").maybeSingle(),
    s.rpc("sistem_havuz_durumu"),
    s.from("kazanim").select("id, kod, sira, unite:unite_id (sira, ders:ders_id (kod, ad, sinav_turu, sira))"),
    s.from("ders").select("kod, ad, sinav_turu, sira").order("sira"),
    s.from("ai_gunluk_tuketim").select("gun, amac, model, cagri, basarisiz, token_giris, token_cikis").gte("gun", yediGun.slice(0, 10)),
    s.from("soru").select("durum, red_nedeni, prompt_surumu").eq("kaynak", "ai").gte("olusturma", yediGun).limit(10000),
    s.from("prompt_surumu").select("gorev, surum").eq("durum", "aktif"),
  ]);

  const tumAyarlar = (ayarlar.data ?? []) as Ayar[];
  const yayinda = new Map(tumAyarlar.filter((a) => a.durum === "yayinda").map((a) => [a.gorev, a]));
  const arsivVar = new Set(tumAyarlar.filter((a) => a.durum === "arsiv").map((a) => a.gorev));
  const durdurulan = new Set((uygulama.data?.durdurulan_ai_gorevleri ?? []) as string[]);

  // Havuz ısı haritası: kazanım × bant
  const stok = new Map<string, { d: number; taze: number }>();
  for (const r of (havuz.data ?? []) as Array<{ kazanim_id: string; zorluk_bandi: number; dogrulanmis: number; taze: number }>) {
    stok.set(`${r.kazanim_id}:${r.zorluk_bandi}`, { d: Number(r.dogrulanmis), taze: Number(r.taze) });
  }
  type KazanimSatiri = { id: string; kod: string; sira: number; unite: { sira: number; ders: { kod: string; ad: string; sinav_turu: string; sira: number } } };
  const kzListe = ((kazanimlar.data ?? []) as unknown as KazanimSatiri[]).sort(
    (a, b) => a.unite.ders.sira - b.unite.ders.sira || a.unite.sira - b.unite.sira || a.sira - b.sira,
  );

  // Maliyet ve kalite
  const tuketimSatirlari = (tuketim.data ?? []) as Array<{ amac: string; model: string; cagri: number; basarisiz: number; token_giris: number; token_cikis: number }>;
  const kirilim = new Map<string, { cagri: number; basarisiz: number; giris: number; cikis: number }>();
  for (const r of tuketimSatirlari) {
    const k = `${r.amac} · ${r.model}`;
    const m = kirilim.get(k) ?? { cagri: 0, basarisiz: 0, giris: 0, cikis: 0 };
    m.cagri += Number(r.cagri);
    m.basarisiz += Number(r.basarisiz);
    m.giris += Number(r.token_giris);
    m.cikis += Number(r.token_cikis);
    kirilim.set(k, m);
  }
  const soruSatirlari = (sorular.data ?? []) as Array<{ durum: string; red_nedeni: string | null }>;
  const dogrulanan = soruSatirlari.filter((r) => r.durum === "dogrulandi").length;
  const reddedilen = soruSatirlari.filter((r) => r.durum === "reddedildi").length;
  const redAsama = new Map<string, number>();
  for (const r of soruSatirlari.filter((x) => x.durum === "reddedildi")) {
    const a = (r.red_nedeni ?? "?").split(":")[0] ?? "?";
    redAsama.set(a, (redAsama.get(a) ?? 0) + 1);
  }
  const aktifPrompt = (gorev: string, varsayilan: string) =>
    ((promptlar.data ?? []) as Array<{ gorev: string; surum: string }>).find((p) => p.gorev === gorev)?.surum ?? `${varsayilan} (kod)`;

  return (
    <PanelKabugu baslik="AI Merkezi" panel="merkez" aktif="/merkez/ai">
      <p className="yol tam"><a href="/merkez">Merkez</a> / AI Merkezi</p>

      <section className="kart tam">
        <h3>Son 7 gün</h3>
        <div className="metrikler">
          <div className="metrik"><strong>{dogrulanan}</strong><span>doğrulanan soru</span></div>
          <div className="metrik"><strong>{reddedilen}</strong><span>atılan soru</span></div>
          <div className="metrik"><strong>%{dogrulanan + reddedilen ? Math.round((reddedilen / (dogrulanan + reddedilen)) * 100) : 0}</strong><span>doğrulamada atılma oranı</span></div>
          <div className="metrik"><strong>{[...kirilim.values()].reduce((t2, m) => t2 + m.giris + m.cikis, 0).toLocaleString("tr-TR")}</strong><span>toplam token</span></div>
        </div>
        {redAsama.size > 0 && (
          <p style={{ marginTop: 12 }}>Red aşamaları: {[...redAsama].map(([a, n]) => `${a} ${n}`).join(" · ")}</p>
        )}
        <p style={{ marginTop: 8 }}>
          Aktif promptlar: <span className="rozet">{aktifPrompt("soru_uretim", SORU_URETIM_VARSAYILAN.surum)}</span>{" "}
          <span className="rozet">{aktifPrompt("soru_dogrulama", SORU_DOGRULAMA_VARSAYILAN.surum)}</span>
        </p>
      </section>

      <section className="kart tam">
        <h3>Görev bazlı model ayarları</h3>
        <p>Değişiklik yeni sürüm olarak yayınlanır; uygulamalar en geç 1 dakikada yeni ayarı kullanır. Model adları KMYAI\'deki adlarıyla yazılır.</p>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="tablo">
            <thead>
              <tr><th>Görev</th><th>Birincil model</th><th>Yedek model</th><th>Sıcaklık</th><th>Maks. token</th><th>Zaman aşımı (ms)</th><th>Deneme</th><th>Sürüm</th><th /></tr>
            </thead>
            <tbody>
              {AI_GOREVLERI.map((g) => {
                const a = yayinda.get(g);
                const formId = `ayar-${g}`;
                return (
                  <tr key={g}>
                    <td>
                      <form id={formId} action={ayarYayinla}><input type="hidden" name="gorev" value={g} /></form>
                      {GOREV_ADI[g] ?? g}
                    </td>
                    <td><input form={formId} name="model_birincil" defaultValue={a?.model_birincil ?? ""} required /></td>
                    <td><input form={formId} name="model_yedek" defaultValue={a?.model_yedek ?? ""} /></td>
                    <td><input form={formId} type="number" step="0.05" name="sicaklik" defaultValue={a?.sicaklik ?? ""} /></td>
                    <td><input form={formId} type="number" name="max_token" defaultValue={a?.max_token ?? ""} /></td>
                    <td><input form={formId} type="number" name="zaman_asimi_ms" defaultValue={a?.zaman_asimi_ms ?? ""} /></td>
                    <td><input form={formId} type="number" name="yeniden_deneme" defaultValue={a?.yeniden_deneme ?? ""} style={{ width: 60 }} /></td>
                    <td><span className="rozet">v{a?.surum ?? "-"}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button form={formId} className="dugme">Yayınla</button>{" "}
                      {arsivVar.has(g) && (
                        <form action={ayarGeriAl} style={{ display: "inline" }}>
                          <input type="hidden" name="gorev" value={g} />
                          <button className="dugme ikincil">Geri al</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kart tam">
        <h3>Acil durum anahtarları</h3>
        <form action={acilDurum} className="form" style={{ marginTop: 8 }}>
          <label><input type="checkbox" name="ai_yedek_mod" defaultChecked={Boolean(uygulama.data?.ai_yedek_mod)} /> <strong>Yedek mod</strong> (KMYAI'ye gidilmez, yalnızca havuzdaki doğrulanmış sorular)</label>
          {AI_GOREVLERI.map((g) => (
            <label key={g}><input type="checkbox" name={`durdur_${g}`} defaultChecked={durdurulan.has(g)} /> {GOREV_ADI[g]} durdur</label>
          ))}
          <button className="dugme tehlike">Kaydet</button>
        </form>
      </section>

      <section className="kart tam">
        <h3>Soru havuzu (doğrulanmış soru sayısı, kazanım × zorluk bandı)</h3>
        <p>Yeşil ≥ 8, sarı 3-7, kırmızı &lt; 3. Parantez içi: düelloya uygun taze soru. Havuz her 10 dakikada otomatik dolar.</p>
        <OnIsitma dersler={((dersler.data ?? []) as Array<{ kod: string; ad: string; sinav_turu: string }>).map((d) => ({ kod: d.kod, ad: d.ad, sinav: d.sinav_turu }))} />
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="tablo">
            <thead>
              <tr><th>Ders</th><th>Kazanım</th>{[1, 2, 3, 4, 5].map((b) => <th key={b}>Bant {b} ({b * 2 - 1}-{b * 2})</th>)}</tr>
            </thead>
            <tbody>
              {kzListe.map((k) => (
                <tr key={k.id}>
                  <td>{k.unite.ders.ad} · {k.unite.ders.sinav_turu}</td>
                  <td>{k.kod}</td>
                  {[1, 2, 3, 4, 5].map((b) => {
                    const v = stok.get(`${k.id}:${b}`) ?? { d: 0, taze: 0 };
                    return (
                      <td key={b}><span className="isi" style={{ background: isiRengi(v.d) }}>{v.d} ({v.taze})</span></td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kart tam">
        <h3>Token tüketimi (son 7 gün, görev ve model kırılımı)</h3>
        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="tablo">
            <thead><tr><th>Görev · model</th><th>Çağrı</th><th>Başarısız</th><th>Giriş token</th><th>Çıkış token</th></tr></thead>
            <tbody>
              {[...kirilim].sort((a, b) => b[1].cagri - a[1].cagri).map(([k, m]) => (
                <tr key={k}><td>{k}</td><td>{m.cagri}</td><td>{m.basarisiz}</td><td>{m.giris.toLocaleString("tr-TR")}</td><td>{m.cikis.toLocaleString("tr-TR")}</td></tr>
              ))}
              {kirilim.size === 0 && <tr><td colSpan={5}>Henüz AI çağrısı yok.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </PanelKabugu>
  );
}
