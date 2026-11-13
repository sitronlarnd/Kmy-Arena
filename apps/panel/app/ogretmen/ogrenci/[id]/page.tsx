import { CubukGrafik, Kart, Metrik, PanelKabugu, Risk } from "@/bilesenler/PanelKabugu";
import { EylemDugmesi, EylemFormu } from "@/bilesenler/Istemci";
import { rehberlikNotu, zayifKonularaOdev } from "@/app/ogretmen/eylemler";
import { onceKac, panelRpc, tarih } from "@/lib/panel";
import { paneleErisebilir, yetkilerim } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Detay {
  id: string; ad: string; takma_ad: string; son_giris: string | null; sinif: string | null; sube: string | null;
  ilerleme: { seviye: number; xp: number; seri: number; toplam_cevap: number; toplam_dogru: number; kupa: number } | null;
  risk: { puan: number; nedenler: string[] };
  gunluk: Array<{ gun: string; soru: number; dk: number }>;
  dersler: Array<{ ders: string; cozulen: number; haftalar: Array<{ hafta: string; n: number; dogruluk: number }> }>;
  guclu: Array<{ kod: string; aciklama: string; ustalik: string }>;
  zayif: Array<{ kod: string; aciklama: string }>;
  hata_defteri: number;
  odevler: Array<{ baslik: string; son_tarih: string; cozulen: number; soru_sayisi: number; bitis: string | null }>;
  duello: { toplam: number; galibiyet: number } | null;
  klan: string | null; rozet: number; veli_bagli: boolean;
  rehberlik: Array<{ id: string; tur: string; metin: string; plan_tarihi: string | null; tamamlandi: boolean; yazar: string; olusturma: string }> | null;
}

export default async function OgrenciDetay({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const y = await yetkilerim();
  const d = await panelRpc<Detay>("panel_ogrenci_detay", { p_ogrenci: id });
  const i = d.ilerleme;
  const dk28 = d.gunluk.reduce((a, g) => a + Number(g.dk), 0);
  return (
    <PanelKabugu baslik={d.ad} panel={paneleErisebilir(y, "dershane") ? "dershane" : "ogretmen"} aktif={paneleErisebilir(y, "dershane") ? "/dershane/ogrenciler" : "/ogretmen"}
      yol={<span>{d.sube} · {d.sinif} · {d.takma_ad}</span>}
      sag={<EylemDugmesi eylem={zayifKonularaOdev.bind(null, null, id)} etiket="Zayıf konularına ödev ver" />}>
      <Metrik deger={i?.seviye ?? 1} etiket="Seviye" renk="#7c5cfa" ikon="★" />
      <Metrik deger={i?.toplam_cevap ?? 0} etiket={`Toplam soru · %${i && i.toplam_cevap ? Math.round((i.toplam_dogru / i.toplam_cevap) * 100) : 0} doğru`} renk="#3fa9f5" ikon="✓" />
      <Metrik deger={`${dk28} dk`} etiket="Son 28 gün çalışma" renk="#12b76a" ikon="◷" />
      <section className="kart">
        <div className="metrik"><Risk puan={d.risk.puan} /><div><strong style={{ fontSize: 18 }}>Risk</strong><span>{d.risk.nedenler.join(" · ") || "Sinyal yok"}</span></div></div>
      </section>

      <Kart genis baslik="Son 28 gün — günlük çözülen soru">
        <CubukGrafik veri={d.gunluk.map((g) => g.soru)} etiketler={d.gunluk.map((g) => tarih(g.gun))} />
      </Kart>

      <Kart baslik="Ders bazında doğruluk (8 hafta)">
        <div className="liste" style={{ marginTop: 12 }}>
          {d.dersler.length === 0 && <p className="bos">Veri yok.</p>}
          {d.dersler.map((x) => (
            <div key={x.ders} className="satir">
              <div className="esnek"><strong>{x.ders}</strong><div className="soluk kucuk">{x.cozulen} soru</div></div>
              <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 34 }}>
                {x.haftalar.map((h) => <span key={h.hafta} title={`${tarih(h.hafta)}: %${h.dogruluk} (${h.n})`} style={{ width: 10, height: `${Math.max(8, h.dogruluk)}%`, borderRadius: 3, background: h.dogruluk >= 70 ? "#12b76a" : h.dogruluk >= 50 ? "#f5a400" : "#e5354f" }} />)}
              </div>
            </div>
          ))}
        </div>
      </Kart>

      <Kart baslik="Güçlü ve zayıf kazanımlar">
        <div className="liste" style={{ marginTop: 12 }}>
          {d.guclu.map((k) => <div key={k.kod} className="satir"><span className="rozet dogru">güçlü</span><div className="esnek kucuk"><b>{k.kod}</b> {k.aciklama}</div></div>)}
          {d.zayif.map((k) => <div key={k.kod} className="satir"><span className="rozet yanlis">zayıf</span><div className="esnek kucuk"><b>{k.kod}</b> {k.aciklama}</div></div>)}
          {d.guclu.length + d.zayif.length === 0 && <p className="bos">Veri yok.</p>}
        </div>
      </Kart>

      <Kart baslik="Oyun ve ödev">
        <div className="liste" style={{ marginTop: 12 }}>
          <div className="satir"><div className="esnek">Son giriş</div><b>{onceKac(d.son_giris)}</b></div>
          <div className="satir"><div className="esnek">Seri</div><b>{i?.seri ?? 0} gün</b></div>
          <div className="satir"><div className="esnek">Hata defteri (açık)</div><b>{d.hata_defteri}</b></div>
          <div className="satir"><div className="esnek">Düello</div><b>{d.duello?.galibiyet ?? 0}/{d.duello?.toplam ?? 0} galibiyet</b></div>
          <div className="satir"><div className="esnek">Klan</div><b>{d.klan ?? "—"}</b></div>
          <div className="satir"><div className="esnek">Rozet</div><b>{d.rozet}</b></div>
          <div className="satir"><div className="esnek">Veli bağlantısı</div><span className={`rozet ${d.veli_bagli ? "dogru" : ""}`}>{d.veli_bagli ? "var" : "yok"}</span></div>
          {d.odevler.map((o) => (
            <div key={o.baslik + o.son_tarih} className="satir">
              <div className="esnek"><b>{o.baslik}</b><div className="soluk kucuk">Son: {tarih(o.son_tarih, true)}</div></div>
              <span className={`rozet ${o.bitis ? "dogru" : Date.parse(o.son_tarih) < Date.now() ? "yanlis" : "altin"}`}>{o.cozulen}/{o.soru_sayisi}</span>
            </div>
          ))}
        </div>
      </Kart>

      {d.rehberlik && (
        <Kart genis baslik="Rehberlik notları" aciklama="Yalnızca rehberlik yetkisi olanlar görür; öğrenci ve veli asla görmez.">
          <div className="liste" style={{ margin: "12px 0" }}>
            {d.rehberlik.length === 0 && <p className="bos">Henüz not yok.</p>}
            {d.rehberlik.map((n) => (
              <div key={n.id} className="satir" style={{ alignItems: "flex-start" }}>
                <span className={`rozet ${n.tur === "gorusme" ? "vurgu" : n.tur === "hedef" ? "altin" : ""}`}>{n.tur}</span>
                <div className="esnek"><div>{n.metin}</div><div className="soluk kucuk">{n.yazar} · {tarih(n.olusturma, true)}{n.plan_tarihi ? ` · plan: ${tarih(n.plan_tarihi, true)}` : ""}</div></div>
              </div>
            ))}
          </div>
          <EylemFormu eylem={rehberlikNotu} dugme="Not ekle" dikey={false}>
            <input type="hidden" name="ogrenci" value={d.id} />
            <select name="tur" className="alan"><option value="not">Not</option><option value="gorusme">Görüşme planı</option><option value="hedef">Hedef</option></select>
            <input name="metin" className="alan" placeholder="Not / görüşme konusu / hedef" style={{ flex: 1, minWidth: 240 }} />
            <input name="plan" type="datetime-local" className="alan" />
          </EylemFormu>
        </Kart>
      )}
    </PanelKabugu>
  );
}
