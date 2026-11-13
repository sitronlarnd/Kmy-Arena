import { t } from "@kmy/shared/i18n";
import type { ReactNode } from "react";

type PanelAdi = "ogretmen" | "dershane" | "merkez";

const MENU: Record<PanelAdi, Array<{ yol: string; ad: string; ikon: string } | { bolum: string }>> = {
  ogretmen: [
    { bolum: "Öğretmen" },
    { yol: "/ogretmen", ad: "Sınıflarım", ikon: "◧" },
    { yol: "/ogretmen/odevler", ad: "Ödevler", ikon: "✎" },
    { yol: "/ogretmen/bekleyenler", ad: "Bekleyenler", ikon: "⚑" },
    { yol: "/ogretmen/duyuru", ad: "Duyuru", ikon: "✉" },
  ],
  dershane: [
    { bolum: "Dershane" },
    { yol: "/dershane", ad: "Genel bakış", ikon: "◎" },
    { yol: "/dershane/ogrenciler", ad: "Öğrenciler", ikon: "☺" },
    { yol: "/dershane/ogretmenler", ad: "Öğretmenler", ikon: "✦" },
    { yol: "/dershane/rehberlik", ad: "Rehberlik", ikon: "♡" },
    { yol: "/dershane/ayarlar", ad: "Ayarlar ve duyuru", ikon: "⚙" },
    { bolum: "Sınıflar" },
    { yol: "/ogretmen", ad: "Sınıf analizi", ikon: "◧" },
    { yol: "/ogretmen/bekleyenler", ad: "Bekleyenler", ikon: "⚑" },
  ],
  merkez: [
    { bolum: "Merkez" },
    { yol: "/merkez", ad: "Genel bakış", ikon: "◎" },
    { yol: "/merkez/ai", ad: "AI Merkezi", ikon: "✦" },
    { yol: "/merkez/bayraklar", ad: "Özellik bayrakları", ikon: "⚑" },
  ],
};

export function PanelKabugu({ baslik, children, panel, aktif, yol, sag }: { baslik: string; children: ReactNode; panel?: PanelAdi; aktif?: string; yol?: ReactNode; sag?: ReactNode }) {
  const p: PanelAdi = panel ?? (baslik === t("panel.merkez") ? "merkez" : "ogretmen");
  return (
    <div className="kabuk">
      <nav className="yan" aria-label="Panel menüsü">
        <div className="logo"><i>K</i>{t("uygulama.ad")}</div>
        {MENU[p].map((m, i) =>
          "bolum" in m ? (
            <div key={i} className="bolum">{m.bolum}</div>
          ) : (
            <a key={m.yol} href={m.yol} className={aktif === m.yol ? "aktif" : undefined}><span aria-hidden>{m.ikon}</span>{m.ad}</a>
          ),
        )}
        <div className="alt"><a href="/cikis">{t("giris.cikisYap")}</a></div>
      </nav>
      <div className="ana">
        <header className="ust">
          <div style={{ flex: 1 }}>
            {yol && <div className="yol">{yol}</div>}
            <h1>{baslik}</h1>
          </div>
          {sag}
        </header>
        <main className="icerik">{children}</main>
      </div>
    </div>
  );
}

export function Kart({ baslik, aciklama, children, genis, vurgu }: { baslik?: string; aciklama?: string; children?: ReactNode; genis?: boolean; vurgu?: boolean }) {
  return (
    <section className={`kart${genis ? " genis" : ""}${vurgu ? " vurgu" : ""}`}>
      {baslik && <h3>{baslik}</h3>}
      {aciklama && <p>{aciklama}</p>}
      {children}
    </section>
  );
}

export function Metrik({ deger, etiket, renk, ikon }: { deger: string | number; etiket: string; renk: string; ikon: string }) {
  return (
    <section className="kart">
      <div className="metrik">
        <div className="ikon" style={{ background: `${renk}22`, color: renk }}>{ikon}</div>
        <div>
          <strong>{deger}</strong>
          <span>{etiket}</span>
        </div>
      </div>
    </section>
  );
}

export function Risk({ puan }: { puan: number }) {
  return <span className={`risk ${puan >= 60 ? "y" : puan >= 30 ? "o" : "d"}`} title="Risk skoru">{puan}</span>;
}

export function Cubuk({ oran }: { oran: number }) {
  return <div className="cubuk"><i style={{ width: `${Math.round(Math.min(1, Math.max(0, oran)) * 100)}%` }} /></div>;
}

/** Basit animasyonlu çizgi grafiği (SVG) */
export function CizgiGrafik({ veri, etiketler, yukseklik = 180 }: { veri: number[]; etiketler: string[]; yukseklik?: number }) {
  const g = 640;
  const enCok = Math.max(1, ...veri);
  const x = (i: number) => 30 + (i * (g - 50)) / Math.max(1, veri.length - 1);
  const y = (v: number) => yukseklik - 28 - (v / enCok) * (yukseklik - 48);
  const yolD = veri.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg className="grafik" viewBox={`0 0 ${g} ${yukseklik}`} width="100%" role="img" aria-label="Haftalık eğilim grafiği">
      <defs>
        <linearGradient id="cizgiGradyan" x1="0" x2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#5b7cff" /></linearGradient>
        <linearGradient id="alanGradyan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7c5cfa55" /><stop offset="1" stopColor="#7c5cfa00" /></linearGradient>
      </defs>
      <path className="alan-dolgu" d={`${yolD} L${x(veri.length - 1)},${yukseklik - 28} L${x(0)},${yukseklik - 28} Z`} />
      <path className="cizgi" d={yolD} />
      {veri.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r={4.5} fill="#fff" stroke="#7c5cfa" strokeWidth={3} />
          <text x={x(i)} y={yukseklik - 8} textAnchor="middle">{etiketler[i]}</text>
          <text x={x(i)} y={y(v) - 10} textAnchor="middle">{v}</text>
        </g>
      ))}
    </svg>
  );
}

export function CubukGrafik({ veri, etiketler, yukseklik = 150 }: { veri: number[]; etiketler: string[]; yukseklik?: number }) {
  const g = 640;
  const enCok = Math.max(1, ...veri);
  const w = (g - 40) / veri.length;
  return (
    <svg className="grafik" viewBox={`0 0 ${g} ${yukseklik}`} width="100%" role="img" aria-label="Günlük çalışma grafiği">
      <defs><linearGradient id="cizgiGradyan" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8b5cf6" /><stop offset="1" stopColor="#5b7cff" /></linearGradient></defs>
      {veri.map((v, i) => {
        const h = (v / enCok) * (yukseklik - 40);
        return (
          <g key={i}>
            <rect className="cubuk-g" style={{ animationDelay: `${i * 20}ms` }} x={20 + i * w + w * 0.15} y={yukseklik - 22 - h} width={w * 0.7} height={Math.max(h, v > 0 ? 2 : 0)} rx={4} />
            {(i % Math.ceil(veri.length / 14) === 0) && <text x={20 + i * w + w / 2} y={yukseklik - 6} textAnchor="middle">{etiketler[i]}</text>}
          </g>
        );
      })}
    </svg>
  );
}
