"use client";

import { useMemo, useState } from "react";

export interface OgrenciSatiri {
  id: string; ad: string; takma_ad: string; sube: string | null; sinif: string | null; son_giris: string | null; sinav_grubu: string | null;
  soru7: number; dogruluk: number | null; seviye: number; veli: boolean; risk: { puan: number; nedenler: string[] };
}

function once(iso: string | null): string {
  if (!iso) return "hiç";
  const g = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  return g === 0 ? "bugün" : `${g} gün önce`;
}

export function OgrenciTablosu({ ogrenciler, yonet }: { ogrenciler: OgrenciSatiri[]; yonet?: boolean }) {
  const [ara, setAra] = useState("");
  const [sube, setSube] = useState("");
  const [sadeceRisk, setSadeceRisk] = useState(false);
  const [sirala, setSirala] = useState<"ad" | "risk" | "soru">("ad");
  const subeler = [...new Set(ogrenciler.map((o) => o.sube).filter(Boolean))] as string[];
  const liste = useMemo(() => {
    const a = ara.toLocaleLowerCase("tr");
    return ogrenciler
      .filter((o) => (!a || `${o.ad} ${o.takma_ad} ${o.sinif}`.toLocaleLowerCase("tr").includes(a)) && (!sube || o.sube === sube) && (!sadeceRisk || o.risk.puan >= 30))
      .sort((x, y) => (sirala === "risk" ? y.risk.puan - x.risk.puan : sirala === "soru" ? y.soru7 - x.soru7 : x.ad.localeCompare(y.ad, "tr")));
  }, [ogrenciler, ara, sube, sadeceRisk, sirala]);
  return (
    <>
      <div className="form" style={{ margin: "12px 0" }}>
        <input className="alan" placeholder="Ad, takma ad, sınıf ara…" value={ara} onChange={(e) => setAra(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <select className="alan" value={sube} onChange={(e) => setSube(e.target.value)}><option value="">Tüm şubeler</option>{subeler.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="alan" value={sirala} onChange={(e) => setSirala(e.target.value as typeof sirala)}><option value="ad">Ada göre</option><option value="risk">Riske göre</option><option value="soru">Haftalık soruya göre</option></select>
        <label className="rozet" style={{ padding: "10px 12px", cursor: "pointer" }}><input type="checkbox" checked={sadeceRisk} onChange={(e) => setSadeceRisk(e.target.checked)} style={{ minHeight: 0 }} /> Yalnız riskli</label>
        <span className="soluk kucuk">{liste.length} öğrenci</span>
      </div>
      <div className="kaydir">
        <table className="tablo">
          <thead><tr><th>Öğrenci</th><th>Şube / Sınıf</th><th>Seviye</th><th>Bu hafta</th><th>Doğruluk</th><th>Son çözüm</th><th>Veli</th><th>Risk</th></tr></thead>
          <tbody>
            {liste.map((o) => (
              <tr key={o.id}>
                <td><a href={`/ogretmen/ogrenci/${o.id}`}>{o.ad}</a><div className="soluk kucuk">{o.takma_ad}{yonet ? <> · <a href={`/dershane/ogrenci/${o.id}`}>yönet</a></> : null}</div></td>
                <td>{o.sube}<div className="soluk kucuk">{o.sinif}</div></td>
                <td>{o.seviye}</td>
                <td>{o.soru7}</td>
                <td>{o.dogruluk === null ? "—" : `%${o.dogruluk}`}</td>
                <td className="soluk">{once((o.risk as unknown as { son_cozum: string | null }).son_cozum ?? null)}</td>
                <td><span className={`rozet ${o.veli ? "dogru" : ""}`}>{o.veli ? "bağlı" : "yok"}</span></td>
                <td title={o.risk.nedenler.join(" · ")}><span className={`risk ${o.risk.puan >= 60 ? "y" : o.risk.puan >= 30 ? "o" : "d"}`}>{o.risk.puan}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
