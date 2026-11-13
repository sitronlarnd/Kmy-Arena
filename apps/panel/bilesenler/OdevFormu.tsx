"use client";

import { useActionState, useMemo, useState } from "react";
import { odevOlustur } from "@/app/ogretmen/eylemler";

export interface DersVerisi { id: string; ad: string; sinav_turu: string; kazanimlar: Array<{ id: string; kod: string; aciklama: string; unite: string }> }

export function OdevFormu({ siniflar, dersler }: { siniflar: Array<{ id: string; ad: string; sinav_turu: string }>; dersler: DersVerisi[] }) {
  const [durum, gonder, bekliyor] = useActionState(odevOlustur, {});
  const [dersId, setDersId] = useState(dersler[0]?.id ?? "");
  const [ara, setAra] = useState("");
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [mod, setMod] = useState("uyarlamali");
  const ders = dersler.find((d) => d.id === dersId);
  const liste = useMemo(
    () => (ders?.kazanimlar ?? []).filter((k) => !ara || `${k.kod} ${k.aciklama} ${k.unite}`.toLocaleLowerCase("tr").includes(ara.toLocaleLowerCase("tr"))),
    [ders, ara],
  );
  const yarin = new Date(Date.now() + 3 * 86400000);
  const varsayilan = `${yarin.toISOString().slice(0, 10)}T22:00`;
  const tum = new Map(dersler.flatMap((d) => d.kazanimlar.map((k) => [k.id, k.kod] as const)));
  return (
    <form action={gonder} className="form dikey">
      <label>Başlık<input name="baslik" className="alan" defaultValue="Haftalık ödev" maxLength={120} /></label>
      <label>Sınıflar</label>
      <div className="form">
        {siniflar.map((s) => (
          <label key={s.id} className="rozet" style={{ cursor: "pointer", padding: "8px 12px" }}>
            <input type="checkbox" name="sinif" value={s.id} style={{ minHeight: 0 }} /> {s.ad}
          </label>
        ))}
      </div>
      <div className="form">
        <label style={{ flex: 1 }}>Ders
          <select className="alan" value={dersId} onChange={(e) => setDersId(e.target.value)}>
            {dersler.map((d) => <option key={d.id} value={d.id}>{d.sinav_turu} · {d.ad}</option>)}
          </select>
        </label>
        <label style={{ flex: 2 }}>Kazanım ara<input className="alan" value={ara} onChange={(e) => setAra(e.target.value)} placeholder="kod, konu…" /></label>
      </div>
      <div className="kaydir" style={{ maxHeight: 260, border: "1px solid var(--kenar)", padding: 8 }}>
        {liste.map((k) => (
          <label key={k.id} className="satir" style={{ cursor: "pointer", marginBottom: 6, fontWeight: 600, color: "var(--metin)" }}>
            <input type="checkbox" checked={secili.has(k.id)} style={{ minHeight: 0 }} onChange={(e) => {
              const n = new Set(secili);
              if (e.target.checked) n.add(k.id); else n.delete(k.id);
              setSecili(n);
            }} />
            <span className="rozet vurgu">{k.kod}</span>
            <span className="esnek kucuk">{k.aciklama}<span className="soluk"> · {k.unite}</span></span>
          </label>
        ))}
      </div>
      {[...secili].map((k) => <input key={k} type="hidden" name="kazanim" value={k} />)}
      <div className="soluk kucuk">Seçili: {[...secili].map((k) => tum.get(k)).join(", ") || "—"}</div>
      <div className="form">
        <label>Soru sayısı<input name="soru_sayisi" type="number" min={3} max={50} defaultValue={10} className="alan" /></label>
        <label>Zorluk
          <select name="zorluk_modu" className="alan" value={mod} onChange={(e) => setMod(e.target.value)}>
            <option value="uyarlamali">Uyarlamalı (önerilen)</option>
            <option value="sabit">Sabit</option>
          </select>
        </label>
        {mod === "sabit" && <label>Zorluk (1-10)<input name="sabit_zorluk" type="number" min={1} max={10} defaultValue={5} className="alan" /></label>}
        <label>Son tarih<input name="son_tarih" type="datetime-local" defaultValue={varsayilan} className="alan" /></label>
      </div>
      <button className="dugme" type="submit" disabled={bekliyor}>{bekliyor ? "Oluşturuluyor…" : "Ödevi gönder"}</button>
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
