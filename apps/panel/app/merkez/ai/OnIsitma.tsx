"use client";

import { useState } from "react";
import { tarayiciIstemcisi } from "@/lib/supabase";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "https://api-bice-phi-66.vercel.app").replace(/\/+$/, "");

interface Rapor {
  dogrulanan: number;
  reddedilen: number;
  atilmaOrani: number;
  ortalamaSoruSuresiMs: number;
  redAsamalari: Record<string, number>;
  islenenCift: number;
  istenenCift: number;
  sureMs: number;
  hata?: string;
}

/**
 * Ön ısıtma / üretim testi: API'yi oturum jetonuyla çağırır (merkez.ai_yonet).
 * Bir istek en fazla ~5 dakika sürer; büyük dersler için birkaç kez çalıştır.
 */
export function OnIsitma({ dersler }: { dersler: Array<{ kod: string; ad: string; sinav: string }> }) {
  const [calisiyor, setCalisiyor] = useState(false);
  const [rapor, setRapor] = useState<Rapor | null>(null);

  async function baslat(form: FormData) {
    setCalisiyor(true);
    setRapor(null);
    try {
      const { data } = await tarayiciIstemcisi().auth.getSession();
      const kazanimlar = String(form.get("kazanimlar") ?? "").split(/[\s,]+/).filter(Boolean);
      const y = await fetch(`${API}/api/yonetim/on-isitma`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({
          ...(kazanimlar.length ? { kazanimKodlari: kazanimlar } : { dersKodu: form.get("ders") }),
          bantlar: form.getAll("bant").map(Number),
          adet: Number(form.get("adet")),
        }),
      });
      setRapor((await y.json()) as Rapor);
    } catch (h) {
      setRapor({ hata: h instanceof Error ? h.message : "hata" } as Rapor);
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form action={baslat} className="form">
        <select name="ders" defaultValue={dersler[0]?.kod}>
          {dersler.map((d) => (
            <option key={d.kod} value={d.kod}>{d.ad} · {d.sinav}</option>
          ))}
        </select>
        <input name="kazanimlar" placeholder="veya kazanım kodları (virgülle)" style={{ minWidth: 220 }} />
        {[1, 2, 3, 4, 5].map((b) => (
          <label key={b}><input type="checkbox" name="bant" value={b} defaultChecked={b <= 3} /> Bant {b}</label>
        ))}
        <label>Adet <input type="number" name="adet" defaultValue={3} min={1} max={10} style={{ width: 60 }} /></label>
        <button className="dugme" disabled={calisiyor}>{calisiyor ? "Üretiliyor… (en fazla 5 dk)" : "Ön ısıt / üretim testi"}</button>
      </form>
      {rapor && (
        <pre className="rapor">
          {rapor.hata
            ? `Hata: ${rapor.hata}`
            : `İşlenen çift: ${rapor.islenenCift}/${rapor.istenenCift}
Doğrulanan: ${rapor.dogrulanan} · Reddedilen: ${rapor.reddedilen} · Atılma oranı: %${Math.round(rapor.atilmaOrani * 100)}
Soru başına ortalama süre: ${(rapor.ortalamaSoruSuresiMs / 1000).toFixed(1)} sn · Toplam: ${(rapor.sureMs / 1000).toFixed(0)} sn
Red aşamaları: ${JSON.stringify(rapor.redAsamalari)}`}
        </pre>
      )}
    </div>
  );
}
