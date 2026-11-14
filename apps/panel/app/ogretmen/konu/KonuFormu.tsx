"use client";

import { useState, useTransition } from "react";
import { KazanimSec } from "@/bilesenler/KazanimSec";
import type { KazanimSecenek } from "@/lib/api";
import { tarayiciIstemcisi } from "@/lib/supabase";
import { yuklemeAdresi } from "../sorular/eylemler";
import { konuKaydet } from "./eylemler";

export function KonuFormu({ kazanimlar }: { kazanimlar: KazanimSecenek[] }) {
  const [kazanim, setKazanim] = useState("");
  const [baslik, setBaslik] = useState("");
  const [tur, setTur] = useState<"video" | "metin" | "baglanti">("video");
  const [yol, setYol] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [metin, setMetin] = useState("");
  const [mesaj, setMesaj] = useState<{ tamam?: string; hata?: string }>({});
  const [bekliyor, basla] = useTransition();

  async function yukle(f: File) {
    setMesaj({});
    const sure = await new Promise<number>((coz) => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => coz(v.duration); v.onerror = () => coz(0); v.src = URL.createObjectURL(f); });
    if (sure > 900) { setMesaj({ hata: "Konu anlatımı videosu en fazla 15 dakika olabilir." }); return; }
    const a = await yuklemeAdresi((f.name.split(".").pop() ?? "").toLowerCase());
    if (a.hata || !a.yol || !a.token) { setMesaj({ hata: a.hata ?? "Yüklenemedi" }); return; }
    const { error } = await tarayiciIstemcisi().storage.from("ogretmen").uploadToSignedUrl(a.yol, a.token, f, { contentType: f.type });
    if (error) { setMesaj({ hata: error.message }); return; }
    setYol(a.yol);
    setMesaj({ tamam: "Video yüklendi." });
  }

  return (
    <div className="form dikey">
      <KazanimSec liste={kazanimlar} deger={kazanim} onDegis={setKazanim} />
      <input className="alan" placeholder="Başlık (ör. Üslü ifadelerde işaret kuralı)" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
      <select className="alan" value={tur} onChange={(e) => setTur(e.target.value as typeof tur)}><option value="video">Video yükle</option><option value="baglanti">Bağlantı (YouTube vb.)</option><option value="metin">Yazılı anlatım</option></select>
      {tur === "video" && <input type="file" accept="video/mp4,video/quicktime,video/webm" className="alan" onChange={(e) => { const f = e.target.files?.[0]; if (f) void yukle(f); }} />}
      {tur === "baglanti" && <input className="alan" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />}
      {tur === "metin" && <textarea className="alan" rows={5} value={metin} onChange={(e) => setMetin(e.target.value)} />}
      <button className="dugme" disabled={bekliyor} onClick={() => basla(async () => setMesaj(await konuKaydet({ kazanimId: kazanim, baslik, tur, yol, url, metin })))}>{bekliyor ? "Kaydediliyor…" : "Ekle"}</button>
      {mesaj.tamam && <span className="bilgi">{mesaj.tamam}</span>}
      {mesaj.hata && <span className="hata">{mesaj.hata}</span>}
    </div>
  );
}
