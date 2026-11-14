"use client";

import { useState } from "react";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { arsivdenOdev, soruDurum } from "./eylemler";
import { canliBaslatArsiv } from "../canli/eylemler";

export interface ArsivSatiri { id: string; html: string; siklar: { h: string; html: string }[]; dogru: string; zorluk: number; durum: string; paylasim: string; benim: boolean; ai: boolean; kazanim: string; cevap: number; basari: number | null; cozum: string | null }

export function Arsiv({ satirlar, siniflar }: { satirlar: ArsivSatiri[]; siniflar: { id: string; ad: string }[] }) {
  const [secili, setSecili] = useState<string[]>([]);
  const [filtre, setFiltre] = useState<"hepsi" | "bekleyen" | "benim" | "paylasilan">("hepsi");
  const l = satirlar.filter((x) => filtre === "hepsi" || (filtre === "bekleyen" ? x.durum === "uretildi" : filtre === "benim" ? x.benim : !x.benim));
  const sec = (id: string) => setSecili((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const sinifSec = <select name="sinif" required className="alan">{siniflar.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>;
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="form">
        {(["hepsi", "bekleyen", "benim", "paylasilan"] as const).map((f) => (
          <button key={f} type="button" className={`dugme kucuk ${filtre === f ? "" : "ikincil"}`} onClick={() => setFiltre(f)}>
            {{ hepsi: "Hepsi", bekleyen: "Onay bekleyen", benim: "Benim", paylasilan: "Paylaşılan" }[f]}
          </button>
        ))}
      </div>
      {secili.length > 0 && (
        <div className="kart" style={{ display: "grid", gap: 10 }}>
          <b>{secili.length} soru seçildi</b>
          <KayitFormu eylem={arsivdenOdev} dugme="Ödev olarak ver">
            <input type="hidden" name="sorular" value={secili.join(",")} />
            <input name="baslik" placeholder="Ödev başlığı" defaultValue="Arşivden ödev" className="alan" />
            {sinifSec}
            <label className="kucuk soluk">Son gün <input type="date" name="son" className="alan" /></label>
          </KayitFormu>
          <KayitFormu eylem={canliBaslatArsiv} dugme="Bu sorularla canlı yarışma başlat">
            <input type="hidden" name="sorular" value={secili.join(",")} />
            {sinifSec}
            <label className="kucuk soluk">Soru süresi (sn) <input type="number" name="sure" min={15} max={120} defaultValue={40} className="alan" style={{ width: 80 }} /></label>
          </KayitFormu>
        </div>
      )}
      {l.length === 0 && <p className="soluk">Bu filtrede soru yok.</p>}
      {l.map((x) => (
        <div key={x.id} className="kart" style={{ display: "grid", gap: 8, borderColor: x.durum === "uretildi" ? "var(--altin)" : undefined }}>
          <div className="form" style={{ justifyContent: "space-between" }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={secili.includes(x.id)} disabled={x.durum !== "dogrulandi"} onChange={() => sec(x.id)} />
              <span className="rozet">{x.kazanim}</span><span className="rozet">Zorluk {x.zorluk}</span>
              {x.ai && <span className="rozet vurgu">AI</span>}
              {x.durum === "uretildi" && <span className="rozet altin">Onay bekliyor</span>}
              {x.paylasim === "dershane" && <span className="rozet">Paylaşıldı</span>}
              {x.cozum && <span className="rozet dogru">Hoca çözümü: {x.cozum}</span>}
              {!x.benim && <span className="rozet">Meslektaş</span>}
            </label>
            <span className="soluk kucuk">{x.cevap} çözüm{x.basari !== null ? ` · %${x.basari} doğru` : ""}</span>
          </div>
          <div className="soru-md" dangerouslySetInnerHTML={{ __html: x.html }} />
          <div style={{ display: "grid", gap: 2, fontSize: 14 }}>
            {x.siklar.map((s) => (
              <div key={s.h} style={{ display: "flex", gap: 8, color: s.h === x.dogru ? "var(--dogru)" : undefined, fontWeight: s.h === x.dogru ? 800 : 500 }}>
                <b>{s.h})</b><span className="soru-md" dangerouslySetInnerHTML={{ __html: s.html }} />
              </div>
            ))}
          </div>
          {x.benim && (
            <div className="form">
              {x.durum === "uretildi" && <KayitDugmesi eylem={soruDurum.bind(null, x.id, "dogrulandi")} etiket="Onayla" tur="dogru" />}
              <a className="dugme kucuk ikincil" href={`/ogretmen/sorular/${x.id}`}>Düzenle</a>
              <KayitDugmesi eylem={soruDurum.bind(null, x.id, x.paylasim === "dershane" ? "kendim" : "paylas")} etiket={x.paylasim === "dershane" ? "Paylaşımı kaldır" : "Dershaneyle paylaş"} tur="ikincil" />
              <KayitDugmesi eylem={soruDurum.bind(null, x.id, x.cevap ? "emekli" : "sil")} etiket={x.durum === "uretildi" ? "Reddet" : x.cevap ? "Arşivden kaldır" : "Sil"} tur="ikincil" onay="Emin misin?" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
