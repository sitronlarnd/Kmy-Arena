import { ESYALAR, GOREV_SABLONLARI, ROZETLER } from "@kmy/shared";
import { ekonomiYayinla, esyaAyarla } from "@/app/merkez/merkez-eylemleri";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";
import { Simulator } from "./Simulator";

export const dynamic = "force-dynamic";

export default async function Ekonomi() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.ekonomi_yonet");
  const s = servis();
  const [{ data: yayin }, { data: gecmis }, { data: esyaAyar }] = await Promise.all([
    s.from("oyun_ayari_surumu").select("ayarlar, yayin_tarihi").eq("durum", "yayinda").maybeSingle(),
    s.from("oyun_ayari_surumu").select("id, yayin_tarihi, ayarlar").eq("durum", "arsiv").order("yayin_tarihi", { ascending: false }).limit(5),
    s.from("esya_ayari").select("*"),
  ]);
  const ay = new Map((esyaAyar ?? []).map((x) => [x.kod as string, x]));
  return (
    <PanelKabugu baslik="Oyun ekonomisi ve içerik" panel="merkez" aktif="/merkez/ekonomi" yol={`Yayındaki sürüm: ${yayin?.yayin_tarihi ? tarih(yayin.yayin_tarihi as string, true) : "varsayılan"}. Yayınlanan değişiklik uygulama güncellemesi olmadan 1 dakikada yansır.`}>
      <Kart genis baslik="Ekonomi ayarları ve simülatör" aciklama="Değişikliği yayınlamadan önce simülasyonla etkisini görün: ortalama seviye, Altın birikimi ve lig dağılımı.">
        <KayitFormu eylem={ekonomiYayinla} dugme="Yayınla">
          <Simulator yayinda={(yayin?.ayarlar as Record<string, unknown>) ?? {}} />
        </KayitFormu>
        {(gecmis ?? []).length > 0 && <details className="kucuk" style={{ marginTop: 10 }}><summary>Önceki sürümler (geri almak için JSON'u kopyalayıp yayınlayın)</summary>
          {(gecmis ?? []).map((g) => <pre key={g.id as string} style={{ whiteSpace: "pre-wrap" }}>{tarih(g.yayin_tarihi as string, true)}: {JSON.stringify(g.ayarlar)}</pre>)}</details>}
      </Kart>
      <Kart genis baslik="Mağaza eşyaları" aciklama="Fiyat, satış durumu ve yayın tarihi (yayın tarihinden önce mağazada görünmez). Yeni eşya görselleri uygulama sürümüyle gelir.">
        <div className="kaydir">
          <table className="tablo"><thead><tr><th>Eşya</th><th>Tür</th><th>Varsayılan</th><th>Ayar</th></tr></thead>
            <tbody>{ESYALAR.filter((e) => !e.rozetle).map((e) => {
              const a = ay.get(e.kod);
              return (
                <tr key={e.kod}><td><b>{e.ad}</b><div className="soluk kucuk">{e.kod}</div></td><td>{e.tur}</td><td>{e.fiyat} Altın{e.minSeviye ? ` · sv ${e.minSeviye}` : ""}</td>
                  <td><KayitFormu eylem={esyaAyarla} dugme="Kaydet">
                    <input type="hidden" name="kod" value={e.kod} />
                    <input name="fiyat" type="number" min={0} defaultValue={(a?.fiyat as number | null) ?? ""} placeholder={String(e.fiyat)} className="alan" style={{ width: 90 }} />
                    <label className="kucuk soluk" style={{ display: "flex", gap: 4, alignItems: "center" }}><input type="checkbox" name="aktif" defaultChecked={a ? Boolean(a.aktif) : true} /> Satışta</label>
                    <input name="yayin" type="date" defaultValue={a?.yayin_tarihi ? String(a.yayin_tarihi).slice(0, 10) : ""} className="alan" />
                  </KayitFormu></td></tr>
              );
            })}</tbody></table>
        </div>
      </Kart>
      <Kart baslik={`Rozetler (${ROZETLER.length})`} aciklama="Rozet koşulları kodda tanımlıdır; listede koşullar görülür.">
        <div className="kaydir" style={{ maxHeight: 360 }}><table className="tablo"><tbody>{ROZETLER.map((r) => <tr key={r.kod}><td><b>{r.ad}</b><div className="soluk kucuk">{r.aciklama}</div></td></tr>)}</tbody></table></div>
      </Kart>
      <Kart baslik={`Görev şablonları (${GOREV_SABLONLARI.length})`}>
        <div className="kaydir" style={{ maxHeight: 360 }}><table className="tablo"><tbody>{GOREV_SABLONLARI.map((g) => <tr key={g.kod}><td><b>{g.baslik}</b><div className="soluk kucuk">{g.tur} · hedef {g.hedef}</div></td><td className="kucuk">{g.xp} XP · {g.altin} Altın</td></tr>)}</tbody></table></div>
      </Kart>
    </PanelKabugu>
  );
}
