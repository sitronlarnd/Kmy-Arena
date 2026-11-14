"use client";

import "katex/dist/katex.min.css";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KazanimSec } from "@/bilesenler/KazanimSec";
import type { KazanimSecenek } from "@/lib/api";
import { mdHtml } from "@/lib/md";
import { tarayiciIstemcisi } from "@/lib/supabase";
import { fotografOku, soruKaydet, yuklemeAdresi, type SoruGirdisi } from "./eylemler";

const HARFLER = ["A", "B", "C", "D", "E"] as const;
const TIPLER: Record<string, string> = { islem: "İşlem", kavram: "Kavram", yorum: "Yorum / yeni nesil", grafik: "Grafik / tablo", problem: "Problem" };

/** Görseli (veya PDF sayfasını) en fazla 1600 px JPEG'e çevirir. */
async function gorseleCevir(dosya: File, sayfa: number): Promise<string> {
  const tuval = document.createElement("canvas");
  if (dosya.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const pdf = await pdfjs.getDocument({ data: await dosya.arrayBuffer() }).promise;
    const p = await pdf.getPage(Math.min(Math.max(1, sayfa), pdf.numPages));
    const g = p.getViewport({ scale: 1 });
    const olcek = Math.min(2.5, 1600 / Math.max(g.width, g.height));
    const v = p.getViewport({ scale: olcek });
    tuval.width = v.width; tuval.height = v.height;
    await p.render({ canvas: tuval, viewport: v }).promise;
  } else {
    const resim = await createImageBitmap(dosya);
    const olcek = Math.min(1, 1600 / Math.max(resim.width, resim.height));
    tuval.width = Math.round(resim.width * olcek); tuval.height = Math.round(resim.height * olcek);
    tuval.getContext("2d")?.drawImage(resim, 0, 0, tuval.width, tuval.height);
  }
  return tuval.toDataURL("image/jpeg", 0.85);
}

function videoSuresi(dosya: File): Promise<number> {
  return new Promise((coz) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { coz(v.duration); URL.revokeObjectURL(v.src); };
    v.onerror = () => coz(0);
    v.src = URL.createObjectURL(dosya);
  });
}

export function SoruEditoru({ kazanimlar, ilk }: { kazanimlar: KazanimSecenek[]; ilk?: SoruGirdisi }) {
  const router = useRouter();
  const [g, setG] = useState<SoruGirdisi>(ilk ?? { kazanimId: "", govde: "", siklar: { A: "", B: "", C: "", D: "" }, dogru: "A", zorluk: 5, tip: "islem", cozumAdimlari: [""], paylasim: "kendim", cozum: null });
  const [mesaj, setMesaj] = useState<{ tamam?: string; hata?: string }>({});
  const [bekliyor, basla] = useTransition();
  const [okuyor, setOkuyor] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sayfa, setSayfa] = useState(1);
  const yks = kazanimlar.find((k) => k.id === g.kazanimId)?.sinav !== "LGS" && Boolean(g.kazanimId);
  const harfler = HARFLER.slice(0, yks || g.siklar.E !== undefined ? 5 : 4);
  const ayarla = (d: Partial<SoruGirdisi>) => setG((x) => ({ ...x, ...d }));

  async function oku(dosya: File) {
    setOkuyor(true); setMesaj({});
    try {
      const r = await fotografOku(await gorseleCevir(dosya, sayfa));
      if (r.hata || !r.veri) { setMesaj({ hata: r.hata ?? "Okunamadı" }); return; }
      const v = r.veri as { govde_md?: string; siklar?: Record<string, string>; kazanim_id?: string | null; dogru?: string | null; cozum_adimlari?: string[] };
      ayarla({
        govde: v.govde_md ?? g.govde, siklar: { ...g.siklar, ...(v.siklar ?? {}) }, kazanimId: v.kazanim_id ?? g.kazanimId,
        dogru: v.dogru ?? g.dogru, cozumAdimlari: v.cozum_adimlari?.length ? v.cozum_adimlari : g.cozumAdimlari,
      });
      setMesaj({ tamam: "Soru okundu. Metni, şıkları, kazanımı ve doğru cevabı kontrol edip kaydedin." });
    } finally { setOkuyor(false); }
  }

  async function cozumYukle(dosya: File) {
    const video = dosya.type.startsWith("video/");
    if (video && (await videoSuresi(dosya)) > 300) { setMesaj({ hata: "Çözüm videosu en fazla 5 dakika olabilir." }); return; }
    if (dosya.size > 200 * 1024 * 1024) { setMesaj({ hata: "Dosya en fazla 200 MB olabilir." }); return; }
    setYukleniyor(true); setMesaj({});
    try {
      const uz = (dosya.name.split(".").pop() ?? "").toLowerCase();
      const a = await yuklemeAdresi(uz);
      if (a.hata || !a.yol || !a.token) { setMesaj({ hata: a.hata ?? "Yüklenemedi" }); return; }
      const { error } = await tarayiciIstemcisi().storage.from("ogretmen").uploadToSignedUrl(a.yol, a.token, dosya, { contentType: dosya.type });
      if (error) { setMesaj({ hata: "Yükleme başarısız: " + error.message }); return; }
      ayarla({ cozum: { tur: video ? "video" : "gorsel", yol: a.yol } });
      setMesaj({ tamam: video ? "Çözüm videosu yüklendi." : "Çözüm görseli yüklendi." });
    } finally { setYukleniyor(false); }
  }

  function kaydet() {
    basla(async () => {
      const r = await soruKaydet(g);
      setMesaj(r);
      if (r.tamam) router.push("/ogretmen/sorular");
    });
  }

  return (
    <div className="editor">
      <div className="kart genis" style={{ display: "grid", gap: 10 }}>
        <b>Fotoğraftan veya PDF'den oku</b>
        <p className="soluk kucuk">Sorunun fotoğrafını ya da PDF'i yükleyin; AI metni, şıkları ve kazanımı doldurur, siz kontrol edip düzeltirsiniz. Görselde yüz veya kişisel bilgi olmasın.</p>
        <div className="form">
          <input type="file" accept="image/*,application/pdf" className="alan" disabled={okuyor} onChange={(e) => { const f = e.target.files?.[0]; if (f) void oku(f); }} />
          <label>PDF sayfası<input type="number" min={1} value={sayfa} onChange={(e) => setSayfa(Number(e.target.value) || 1)} className="alan" style={{ width: 80 }} /></label>
          {okuyor && <span className="bilgi">Okunuyor… (20-40 sn)</span>}
        </div>
      </div>
      <div className="izgara-form">
        <label className="tam">Kazanım<KazanimSec liste={kazanimlar} deger={g.kazanimId} onDegis={(v) => ayarla({ kazanimId: v })} /></label>
        <label>Soru tipi<select className="alan" value={g.tip} onChange={(e) => ayarla({ tip: e.target.value })}>{Object.entries(TIPLER).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></label>
        <label>Zorluk (1-10)<input type="number" min={1} max={10} className="alan" value={g.zorluk} onChange={(e) => ayarla({ zorluk: Number(e.target.value) })} /></label>
        <label>Paylaşım<select className="alan" value={g.paylasim} onChange={(e) => ayarla({ paylasim: e.target.value as "kendim" | "dershane" })}><option value="kendim">Yalnız ben</option><option value="dershane">Dershanedeki öğretmenler</option></select></label>
      </div>
      <div className="iki-sutun">
        <label className="dikey-alan">Soru metni (Markdown + LaTeX: <code>$x^2$</code>, <code>**kalın**</code>)
          <textarea className="alan" rows={8} value={g.govde} onChange={(e) => ayarla({ govde: e.target.value })} />
        </label>
        <div className="onizleme"><span className="soluk kucuk">Önizleme</span><div dangerouslySetInnerHTML={{ __html: mdHtml(g.govde || "_Soru metni_") }} /></div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {harfler.map((h) => (
          <div key={h} className="form" style={{ flexWrap: "nowrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="radio" name="dogru" checked={g.dogru === h} onChange={() => ayarla({ dogru: h })} /> <b>{h}</b></label>
            <input className="alan" style={{ flex: 1 }} value={g.siklar[h] ?? ""} onChange={(e) => ayarla({ siklar: { ...g.siklar, [h]: e.target.value } })} placeholder={`${h} şıkkı`} />
            <span className="onizleme-sik" dangerouslySetInnerHTML={{ __html: mdHtml(g.siklar[h] ?? "") }} />
          </div>
        ))}
        {harfler.length === 4 && <button type="button" className="dugme kucuk ikincil" style={{ justifySelf: "start" }} onClick={() => ayarla({ siklar: { ...g.siklar, E: "" } })}>+ E şıkkı (YKS)</button>}
      </div>
      <label className="dikey-alan">Çözüm adımları (her satır bir adım)
        <textarea className="alan" rows={4} value={g.cozumAdimlari.join("\n")} onChange={(e) => ayarla({ cozumAdimlari: e.target.value.split("\n") })} />
      </label>
      <div className="kart genis" style={{ display: "grid", gap: 8 }}>
        <b>Hocanın çözümü (isteğe bağlı)</b>
        <div className="form">
          <select className="alan" value={g.cozum?.tur ?? ""} onChange={(e) => ayarla({ cozum: e.target.value ? { tur: e.target.value as "video" | "gorsel" | "metin" | "baglanti" } : null })}>
            <option value="">Yok</option><option value="video">Video (en fazla 5 dk)</option><option value="gorsel">Fotoğraf</option><option value="metin">Yazılı açıklama</option><option value="baglanti">Bağlantı (YouTube vb.)</option>
          </select>
          {(g.cozum?.tur === "video" || g.cozum?.tur === "gorsel") && (
            <input type="file" className="alan" accept={g.cozum.tur === "video" ? "video/mp4,video/quicktime,video/webm" : "image/*"} disabled={yukleniyor}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void cozumYukle(f); }} />
          )}
          {g.cozum?.yol && <span className="rozet dogru">Yüklendi</span>}
          {yukleniyor && <span className="bilgi">Yükleniyor…</span>}
          {g.cozum?.tur === "baglanti" && <input className="alan" style={{ minWidth: 320 }} placeholder="https://…" value={g.cozum.url ?? ""} onChange={(e) => ayarla({ cozum: { tur: "baglanti", url: e.target.value } })} />}
        </div>
        {g.cozum?.tur === "metin" && <textarea className="alan" rows={3} value={g.cozum.metin ?? ""} onChange={(e) => ayarla({ cozum: { tur: "metin", metin: e.target.value } })} />}
      </div>
      <div className="form">
        <button className="dugme" disabled={bekliyor} onClick={kaydet}>{bekliyor ? "Kaydediliyor…" : "Kaydet"}</button>
        {mesaj.tamam && <span className="bilgi">{mesaj.tamam}</span>}
        {mesaj.hata && <span className="hata">{mesaj.hata}</span>}
      </div>
    </div>
  );
}
