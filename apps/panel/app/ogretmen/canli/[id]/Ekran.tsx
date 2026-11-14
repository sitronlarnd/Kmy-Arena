"use client";

import { useEffect, useRef, useState } from "react";

interface Durum {
  ad: string; pin: string; baslangic: string; sure_sn: number; aralik_sn: number; soru_sayisi: number; sira: number; acilis: string; kapandi: boolean; bitti: boolean;
  sunucu_zamani: number; katilimci: number; cevap_sayisi: number; dagilim: Record<string, number> | null;
  soru: { html: string; siklar: { h: string; html: string }[]; dogru: string | null } | null;
  siralama: { ad: string; puan: number; dogru: number }[];
}

/** Projeksiyon için tam ekran canlı yarışma görünümü (1 sn yoklama). */
export function Ekran({ id }: { id: string }) {
  const [d, setD] = useState<Durum | null>(null);
  const [fark, setFark] = useState(0);
  const [simdi, setSimdi] = useState(() => Date.now());
  const hata = useRef(0);
  useEffect(() => {
    let dur = false;
    const yokla = async () => {
      try {
        const r = await fetch(`/ogretmen/canli/${id}/durum`, { cache: "no-store" });
        if (r.ok) { const j = (await r.json()) as Durum; if (!dur) { setD(j); setFark(j.sunucu_zamani - Date.now()); } hata.current = 0; }
      } catch { hata.current++; }
    };
    void yokla();
    const a = setInterval(() => void yokla(), 1000);
    const b = setInterval(() => setSimdi(Date.now()), 200);
    return () => { dur = true; clearInterval(a); clearInterval(b); };
  }, [id]);
  if (!d) return <div className="canli-ekran"><p>Yükleniyor…</p></div>;
  const t = simdi + fark;
  const bas = Date.parse(d.baslangic);
  const kalan = d.sira >= 1 ? Math.max(0, Math.ceil((Date.parse(d.acilis) + d.sure_sn * 1000 - t) / 1000)) : Math.max(0, Math.ceil((bas - t) / 1000));
  const toplamCevap = d.dagilim ? Object.values(d.dagilim).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="canli-ekran">
      <header>
        <div><b>{d.ad}</b><span>{d.sira >= 1 ? `Soru ${d.sira} / ${d.soru_sayisi}` : "Başlamak üzere"}</span></div>
        <div className="pin">KMY Arena › Canlı › PIN <b>{d.pin}</b></div>
        <div><span>{d.katilimci} katılımcı</span></div>
      </header>
      {d.bitti ? (
        <section className="sonuc">
          <h1>Yarışma bitti!</h1>
          <ol>{d.siralama.map((x, i) => <li key={x.ad + i} className={i < 3 ? `ilk${i + 1}` : ""}><span>{i + 1}</span><b>{x.ad}</b><em>{x.puan} puan · {x.dogru} doğru</em></li>)}</ol>
        </section>
      ) : d.sira < 1 || !d.soru ? (
        <section className="bekle">
          <h1>Uygulamada <b>Canlı</b> › <b>PIN ile katıl</b></h1>
          <div className="dev-pin">{d.pin}</div>
          <p>Başlamasına {kalan} sn</p>
        </section>
      ) : (
        <section className="soru-alan">
          <div className="sayac" style={{ ["--oran" as string]: `${(kalan / d.sure_sn) * 100}%` }}>{d.kapandi ? "✓" : kalan}</div>
          <div className="soru-metni" dangerouslySetInnerHTML={{ __html: d.soru.html }} />
          <div className="siklar">
            {d.soru.siklar.map((s) => {
              const n = d.dagilim?.[s.h] ?? 0;
              return (
                <div key={s.h} className={`sik ${d.kapandi ? (s.h === d.soru?.dogru ? "dogru" : "soluk") : ""}`}>
                  <b>{s.h}</b><span dangerouslySetInnerHTML={{ __html: s.html }} />
                  {d.kapandi && <i style={{ width: `${toplamCevap ? (n / toplamCevap) * 100 : 0}%` }} />}
                  {d.kapandi && <em>{n}</em>}
                </div>
              );
            })}
          </div>
          <footer>{d.kapandi ? "Sıralama" : `${d.cevap_sayisi} cevap geldi`}</footer>
          {d.kapandi && <ol className="mini">{d.siralama.slice(0, 5).map((x, i) => <li key={x.ad + i}><span>{i + 1}</span><b>{x.ad}</b><em>{x.puan}</em></li>)}</ol>}
        </section>
      )}
    </div>
  );
}
