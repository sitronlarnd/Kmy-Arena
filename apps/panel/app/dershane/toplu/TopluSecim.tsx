"use client";

import { useMemo, useState, useTransition } from "react";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { SonucListesi } from "@/bilesenler/Kayit";
import type { OgrenciSatiri } from "@/bilesenler/OgrenciTablosu";
import { topluDuyuru, topluOdev, topluSinif } from "./eylemler";

export function TopluSecim({ ogrenciler, siniflar }: { ogrenciler: OgrenciSatiri[]; siniflar: { id: string; ad: string }[] }) {
  const [secili, setSecili] = useState<string[]>([]);
  const [filtre, setFiltre] = useState("");
  const [hedef, setHedef] = useState(siniflar[0]?.id ?? "");
  const [baslik, setBaslik] = useState("");
  const [metin, setMetin] = useState("");
  const [sonuc, setSonuc] = useState<KayitSonucu | null>(null);
  const [bekliyor, basla] = useTransition();
  const l = useMemo(() => ogrenciler.filter((o) => !filtre || `${o.ad} ${o.sinif ?? ""} ${o.sube ?? ""}`.toLocaleLowerCase("tr-TR").includes(filtre.toLocaleLowerCase("tr-TR"))), [ogrenciler, filtre]);
  const calistir = (f: () => Promise<KayitSonucu>) => basla(async () => setSonuc(await f()));
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="form">
        <input className="alan" placeholder="Ara: ad, sınıf, şube" value={filtre} onChange={(e) => setFiltre(e.target.value)} />
        <button type="button" className="dugme kucuk ikincil" onClick={() => setSecili(l.map((o) => o.id))}>Görünenlerin hepsini seç ({l.length})</button>
        <button type="button" className="dugme kucuk ikincil" onClick={() => setSecili([])}>Seçimi temizle</button>
        <b>{secili.length} seçili</b>
      </div>
      {secili.length > 0 && (
        <div className="kart" style={{ display: "grid", gap: 10 }}>
          <div className="form"><b>Sınıf değiştir:</b>
            <select className="alan" value={hedef} onChange={(e) => setHedef(e.target.value)}>{siniflar.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
            <button className="dugme kucuk" disabled={bekliyor} onClick={() => calistir(() => topluSinif(secili, hedef))}>Taşı</button>
          </div>
          <div className="form"><b>Duyuru:</b>
            <input className="alan" placeholder="Başlık" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
            <input className="alan" style={{ flex: 1, minWidth: 260 }} placeholder="Metin (uygulamada ve bildirim olarak)" value={metin} onChange={(e) => setMetin(e.target.value)} />
            <button className="dugme kucuk" disabled={bekliyor} onClick={() => calistir(() => topluDuyuru(secili, baslik, metin))}>Gönder</button>
          </div>
          <div className="form"><b>Ödev:</b>
            <button className="dugme kucuk" disabled={bekliyor} onClick={() => calistir(() => topluOdev(secili))}>Her birine kendi zayıf konularından 10 soruluk ödev</button>
          </div>
          {bekliyor && <span className="bilgi">İşleniyor…</span>}
          {sonuc && <SonucListesi s={sonuc} />}
        </div>
      )}
      <div className="kaydir">
        <table className="tablo">
          <thead><tr><th /><th>Öğrenci</th><th>Şube / sınıf</th><th>7 gün soru</th><th>Risk</th><th>Veli</th></tr></thead>
          <tbody>{l.map((o) => (
            <tr key={o.id} onClick={() => setSecili((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))} style={{ cursor: "pointer" }}>
              <td><input type="checkbox" readOnly checked={secili.includes(o.id)} /></td>
              <td><b>{o.ad}</b></td><td>{o.sube} · {o.sinif}</td><td>{o.soru7}</td>
              <td>{o.risk.puan >= 50 ? <span className="rozet yanlis">{o.risk.puan}</span> : o.risk.puan}</td><td>{o.veli ? "✓" : "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
