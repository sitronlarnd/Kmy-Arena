"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SonucListesi } from "@/bilesenler/Kayit";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";
import { denemeIceAktar, denemeOnizle, type Onizleme } from "./eylemler";

/** Optik okuyucu çıktısı → sütun eşleştirme → içe aktarma. */
export function DenemeSihirbazi() {
  const router = useRouter();
  const [dosya, setDosya] = useState<File | null>(null);
  const [o, setO] = useState<Onizleme | null>(null);
  const [es, setEs] = useState<NonNullable<Onizleme["oneri"]> | null>(null);
  const [sonuc, setSonuc] = useState<KayitSonucu | null>(null);
  const [bekliyor, basla] = useTransition();
  const sec = (deger: string | null, d: (v: string | null) => void) => (
    <select className="alan" value={deger ?? ""} onChange={(e) => d(e.target.value || null)}>
      <option value="">—</option>{(o?.basliklar ?? []).map((b) => <option key={b} value={b}>{b}</option>)}
    </select>
  );
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div className="form">
        <input type="file" accept=".xlsx,.csv" className="alan" onChange={(e) => { const f = e.target.files?.[0] ?? null; setDosya(f); setO(null); setSonuc(null);
          if (f) basla(async () => { const fd = new FormData(); fd.set("dosya", f); const r = await denemeOnizle(fd); setO(r); setEs(r.oneri ?? null); }); }} />
        {bekliyor && <span className="bilgi">Okunuyor…</span>}
        {o?.hata && <span className="hata">{o.hata}</span>}
      </div>
      {o?.basliklar && es && (
        <>
          <div className="kaydir"><table className="tablo"><thead><tr>{o.basliklar.map((b) => <th key={b}>{b}</th>)}</tr></thead>
            <tbody>{o.ornek?.map((r, i) => <tr key={i}>{r.map((h, j) => <td key={j}>{h}</td>)}</tr>)}</tbody></table></div>
          <div className="izgara-form">
            <h3 className="tam">Öğrenci eşleştirme (biri yeterli)</h3>
            <label>Öğrenci no sütunu{sec(es.ogrenciNo, (v) => setEs({ ...es, ogrenciNo: v }))}</label>
            <label>Ad Soyad (tek sütun){sec(es.adSoyad, (v) => setEs({ ...es, adSoyad: v }))}</label>
            <label>Ad{sec(es.ad, (v) => setEs({ ...es, ad: v }))}</label>
            <label>Soyad{sec(es.soyad, (v) => setEs({ ...es, soyad: v }))}</label>
            <h3 className="tam">Dersler (net sütunu zorunlu; doğru/yanlış isteğe bağlı)</h3>
            {es.dersler.map((d, i) => (
              <div key={i} className="tam form">
                <input className="alan" value={d.ders} onChange={(e) => setEs({ ...es, dersler: es.dersler.map((x, j) => (j === i ? { ...x, ders: e.target.value } : x)) })} style={{ width: 160 }} />
                <span className="soluk kucuk">Net</span>{sec(d.net, (v) => setEs({ ...es, dersler: es.dersler.map((x, j) => (j === i ? { ...x, net: v ?? "" } : x)) }))}
                <span className="soluk kucuk">D</span>{sec(d.dogru, (v) => setEs({ ...es, dersler: es.dersler.map((x, j) => (j === i ? { ...x, dogru: v } : x)) }))}
                <span className="soluk kucuk">Y</span>{sec(d.yanlis, (v) => setEs({ ...es, dersler: es.dersler.map((x, j) => (j === i ? { ...x, yanlis: v } : x)) }))}
                <button type="button" className="dugme kucuk ikincil" onClick={() => setEs({ ...es, dersler: es.dersler.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
            <button type="button" className="dugme kucuk ikincil" style={{ justifySelf: "start" }} onClick={() => setEs({ ...es, dersler: [...es.dersler, { ders: "Ders", net: "", dogru: null, yanlis: null }] })}>+ Ders</button>
          </div>
          <form className="form" action={(fd) => basla(async () => {
            if (!dosya) return;
            fd.set("dosya", dosya); fd.set("eslesme", JSON.stringify(es));
            const r = await denemeIceAktar(fd); setSonuc(r);
            if (r.id) router.push(`/dershane/deneme/${r.id}`);
          })}>
            <input name="ad" required placeholder="Deneme adı (ör. LGS Deneme 3)" className="alan" />
            <input name="tarih" type="date" required className="alan" defaultValue={new Date().toISOString().slice(0, 10)} />
            <select name="sinav" className="alan"><option>LGS</option><option>TYT</option><option>AYT</option><option>YDT</option></select>
            <button className="dugme" disabled={bekliyor}>{bekliyor ? "Aktarılıyor…" : "İçe aktar"}</button>
          </form>
        </>
      )}
      {sonuc && <SonucListesi s={sonuc} />}
    </div>
  );
}
