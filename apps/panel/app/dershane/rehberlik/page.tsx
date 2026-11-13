import { rehberlikDurum } from "@/app/dershane/eylemler";
import { Kart, PanelKabugu, Risk } from "@/bilesenler/PanelKabugu";
import { panelRpc, tarih } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Rehberlik {
  bildirimler: Array<{ id: string; ogrenci_id: string; ogrenci: string; kaynak: string; ozet: string; durum: string; olusturma: string }>;
  riskliler: Array<{ id: string; ad: string; puan: number; nedenler: string[] }>;
  planlar: Array<{ id: string; ogrenci_id: string; ogrenci: string; tur: string; metin: string; plan_tarihi: string | null }>;
}

export default async function RehberlikSayfasi() {
  await paneliKoru("dershane");
  const r = await panelRpc<Rehberlik>("panel_rehberlik");
  const yeni = r.bildirimler.filter((b) => b.durum === "yeni");
  return (
    <PanelKabugu baslik="Rehberlik" panel="dershane" aktif="/dershane/rehberlik">
      {yeni.length > 0 && (
        <Kart genis baslik={`Acil destek bildirimleri · ${yeni.length}`} aciklama="Asistan ya da toplulukta destek gerektirebilecek ifadeler. İçerik paylaşılmaz; lütfen öğrenciyle yüz yüze görüşün.">
          <div className="liste" style={{ marginTop: 12 }}>
            {yeni.map((b) => (
              <div key={b.id} className="satir" style={{ borderLeft: "4px solid var(--yanlis)" }}>
                <div className="esnek"><a href={`/ogretmen/ogrenci/${b.ogrenci_id}`}><b>{b.ogrenci}</b></a><div className="soluk kucuk">{b.ozet} · {tarih(b.olusturma, true)} · {b.kaynak}</div></div>
                <form action={rehberlikDurum}><input type="hidden" name="tur" value="bildirim" /><input type="hidden" name="id" value={b.id} /><input type="hidden" name="durum" value="goruldu" /><button className="dugme kucuk">Görüldü</button></form>
                <form action={rehberlikDurum}><input type="hidden" name="tur" value="bildirim" /><input type="hidden" name="id" value={b.id} /><input type="hidden" name="durum" value="kapandi" /><button className="dugme kucuk ikincil">Kapat</button></form>
              </div>
            ))}
          </div>
        </Kart>
      )}
      <Kart baslik="Risk listesi" aciklama="Skoru 40 ve üstü öğrenciler">
        <div className="liste" style={{ marginTop: 12 }}>
          {r.riskliler.length === 0 && <p className="bos">Riskli öğrenci yok.</p>}
          {r.riskliler.map((o) => (
            <a key={o.id} href={`/ogretmen/ogrenci/${o.id}`} className="satir" style={{ color: "inherit", textDecoration: "none" }}>
              <Risk puan={o.puan} />
              <div className="esnek"><b>{o.ad}</b><div className="soluk kucuk">{o.nedenler.join(" · ")}</div></div>
            </a>
          ))}
        </div>
      </Kart>
      <Kart baslik="Planlanan görüşmeler ve hedefler">
        <div className="liste" style={{ marginTop: 12 }}>
          {r.planlar.length === 0 && <p className="bos">Plan yok. Öğrenci sayfasından not ekleyebilirsin.</p>}
          {r.planlar.map((p) => (
            <div key={p.id} className="satir">
              <span className={`rozet ${p.tur === "gorusme" ? "vurgu" : "altin"}`}>{p.tur}</span>
              <div className="esnek"><a href={`/ogretmen/ogrenci/${p.ogrenci_id}`}><b>{p.ogrenci}</b></a><div className="soluk kucuk">{p.metin}{p.plan_tarihi ? ` · ${tarih(p.plan_tarihi, true)}` : ""}</div></div>
              <form action={rehberlikDurum}><input type="hidden" name="tur" value="not" /><input type="hidden" name="id" value={p.id} /><button className="dugme kucuk dogru">Tamamlandı</button></form>
            </div>
          ))}
        </div>
      </Kart>
      {r.bildirimler.filter((b) => b.durum !== "yeni").length > 0 && (
        <Kart genis baslik="Geçmiş bildirimler">
          <div className="liste" style={{ marginTop: 12 }}>
            {r.bildirimler.filter((b) => b.durum !== "yeni").map((b) => (
              <div key={b.id} className="satir"><span className="rozet">{b.durum}</span><div className="esnek kucuk"><b>{b.ogrenci}</b> · {tarih(b.olusturma, true)}</div></div>
            ))}
          </div>
        </Kart>
      )}
    </PanelKabugu>
  );
}
