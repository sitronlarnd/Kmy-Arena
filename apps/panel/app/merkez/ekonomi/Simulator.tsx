"use client";

import { ayarlariBirlestir, OYUN_AYARLARI, xpdenSeviye, xpHesapla, type OyunAyarlari } from "@kmy/shared";
import { useMemo, useState } from "react";

/**
 * Ekonomi simülatörü: 100 sanal öğrencinin 30 günlük davranışı (günlük soru
 * sayısı ve doğruluk dağılımı farklı 4 profil) mevcut ve önerilen ayarlarla
 * karşılaştırılır. Tohumlu rastgele: iki ayar aynı öğrencilerle çalışır.
 */
function rastgele(tohum: number) { let s = tohum >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

interface Sonuc { ortSeviye: number; ortAltin: number; ortXp: number; seviyeDagilim: number[]; ligDagilim: number[] }

function simule(a: OyunAyarlari): Sonuc {
  const r = rastgele(42);
  const profiller = [{ p: 0.2, soru: 35, dogru: 0.72 }, { p: 0.35, soru: 15, dogru: 0.62 }, { p: 0.3, soru: 6, dogru: 0.55 }, { p: 0.15, soru: 1, dogru: 0.5 }];
  const ogrenciler = Array.from({ length: 100 }, () => {
    const x = r(); let t = 0;
    const pr = profiller.find((p) => (t += p.p) >= x) ?? { p: 0.35, soru: 15, dogru: 0.62 };
    return { ...pr, xp: 0, altin: 0, haftalik: [0, 0, 0, 0, 0] as number[], seri: 0 };
  });
  for (let gun = 0; gun < 30; gun++) {
    for (const o of ogrenciler) {
      const bugun = Math.max(0, Math.round(o.soru * (0.4 + r() * 1.2) * (r() < 0.15 ? 0 : 1)));
      let ardisik = 0;
      for (let i = 0; i < bugun; i++) {
        const zorluk = 3 + Math.round(r() * 5);
        const dogru = r() < o.dogru;
        if (dogru) {
          ardisik++;
          const xp = xpHesapla({ zorluk, sureMs: 30000 + r() * 40000, tahminiSureMs: 60000, seri: ardisik, ipucuSayisi: r() < 0.2 ? 1 : 0, beklenen: o.dogru }, a);
          o.xp += xp; const h = Math.min(4, Math.floor(gun / 7)); o.haftalik[h] = (o.haftalik[h] ?? 0) + xp; o.altin += a.altin.dogruCevap;
        } else ardisik = 0;
      }
      if (bugun >= a.seri.gunlukHedefSoru) { o.seri++; o.altin += a.altin.gunlukGorev; } else o.seri = 0;
    }
  }
  const sev = ogrenciler.map((o) => xpdenSeviye(o.xp));
  const seviyeDagilim = [0, 0, 0, 0, 0];
  for (const s of sev) { const i = s < 5 ? 0 : s < 10 ? 1 : s < 20 ? 2 : s < 35 ? 3 : 4; seviyeDagilim[i] = (seviyeDagilim[i] ?? 0) + 1; }
  // Lig: her hafta her kademe kendi içinde sıralanır; ilk 'yukselen/grup' oranı bir üst, son 'dusen/grup' oranı bir alt kademeye
  const kademe = ogrenciler.map(() => 0);
  const grup = (a.lig.grupMin + a.lig.grupMax) / 2;
  for (let h = 0; h < 4; h++) {
    const yeni = [...kademe];
    for (let k = 0; k <= 5; k++) {
      const uyeler = ogrenciler.map((o, i) => ({ i, x: o.haftalik[h] ?? 0 })).filter((u) => kademe[u.i] === k).sort((p, q) => q.x - p.x);
      if (!uyeler.length) continue;
      const n = k < 5 ? Math.round((a.lig.yukselen / grup) * uyeler.length) : 0, d = k > 0 ? Math.round((a.lig.dusen / grup) * uyeler.length) : 0;
      uyeler.slice(0, n).forEach((u) => { yeni[u.i] = k + 1; });
      if (d) uyeler.slice(-d).forEach((u) => { yeni[u.i] = k - 1; });
    }
    kademe.splice(0, kademe.length, ...yeni);
  }
  const ligDagilim = [0, 0, 0, 0, 0, 0];
  for (const k of kademe) ligDagilim[k] = (ligDagilim[k] ?? 0) + 1;
  return { ortSeviye: sev.reduce((p, q) => p + q, 0) / 100, ortAltin: ogrenciler.reduce((p, o) => p + o.altin, 0) / 100, ortXp: ogrenciler.reduce((p, o) => p + o.xp, 0) / 100, seviyeDagilim, ligDagilim };
}

const SEV = ["1-4", "5-9", "10-19", "20-34", "35+"];
const LIG = ["Bronz", "Gümüş", "Altın", "Platin", "Elmas", "Efsane"];

export function Simulator({ yayinda, ad = "ayarlar" }: { yayinda: Record<string, unknown>; ad?: string }) {
  const [metin, setMetin] = useState(JSON.stringify(yayinda, null, 2));
  let hata = "";
  try { JSON.parse(metin); } catch { hata = "JSON hatalı"; }
  const mevcut = useMemo(() => simule(ayarlariBirlestir(OYUN_AYARLARI, yayinda)), [yayinda]);
  const yeni = useMemo(() => {
    try { return simule(ayarlariBirlestir(OYUN_AYARLARI, JSON.parse(metin) as Record<string, unknown>)); } catch { return null; }
  }, [metin]);
  const satir = (b: string, x: number, y: number | undefined, ond = 0) => (
    <tr><td>{b}</td><td>{x.toFixed(ond)}</td><td>{y === undefined ? "—" : y.toFixed(ond)}</td><td style={{ color: y !== undefined && y !== x ? (y > x ? "var(--dogru)" : "var(--yanlis)") : undefined }}>{y === undefined ? "" : `${y >= x ? "+" : ""}${((y / (x || 1) - 1) * 100).toFixed(0)}%`}</td></tr>
  );
  return (
    <div className="iki-sutun">
      <label className="dikey-alan">Yayındaki ayarların üzerine yazılan değerler (varsayılanlar: oyun-ayarlari.ts)
        <textarea name={ad} className="alan" rows={18} value={metin} onChange={(e) => setMetin(e.target.value)} />
        {hata && <span className="hata">{hata}</span>}
        <span className="soluk kucuk">Örnek: {`{"xp": {"tabanCarpan": 12}, "altin": {"dogruCevap": 3}, "lig": {"yukselen": 6}}`}</span>
      </label>
      <div>
        <b>100 sanal öğrenci · 30 gün</b>
        <table className="tablo" style={{ marginTop: 8 }}>
          <thead><tr><th /><th>Yayındaki</th><th>Önerilen</th><th>Fark</th></tr></thead>
          <tbody>
            {satir("Ortalama seviye", mevcut.ortSeviye, yeni?.ortSeviye, 1)}
            {satir("Ortalama XP", mevcut.ortXp, yeni?.ortXp)}
            {satir("Ortalama Altın birikimi", mevcut.ortAltin, yeni?.ortAltin)}
          </tbody>
        </table>
        <p className="kucuk soluk" style={{ marginTop: 10 }}>Seviye dağılımı (öğrenci sayısı)</p>
        <table className="tablo"><thead><tr><th />{SEV.map((s) => <th key={s}>{s}</th>)}</tr></thead>
          <tbody><tr><td>Yayındaki</td>{mevcut.seviyeDagilim.map((n, i) => <td key={i}>{n}</td>)}</tr><tr><td>Önerilen</td>{(yeni?.seviyeDagilim ?? []).map((n, i) => <td key={i}>{n}</td>)}</tr></tbody></table>
        <p className="kucuk soluk" style={{ marginTop: 10 }}>4 hafta sonra lig dağılımı</p>
        <table className="tablo"><thead><tr><th />{LIG.map((s) => <th key={s}>{s}</th>)}</tr></thead>
          <tbody><tr><td>Yayındaki</td>{mevcut.ligDagilim.map((n, i) => <td key={i}>{n}</td>)}</tr><tr><td>Önerilen</td>{(yeni?.ligDagilim ?? []).map((n, i) => <td key={i}>{n}</td>)}</tr></tbody></table>
      </div>
    </div>
  );
}
