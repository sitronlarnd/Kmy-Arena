"use client";

import { useState, type FormEvent } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api-bice-phi-66.vercel.app";
const HATA: Record<string, string> = {
  "teklif.eksik": "Dershane adı, şehir ve yetkili adı gerekli.",
  "teklif.eposta": "Geçerli bir e-posta yazın.",
  "teklif.telefon": "Telefon numarasını kontrol edin.",
  "teklif.cokFazla": "Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.",
};

export function TeklifFormu() {
  const [durum, setDurum] = useState<"bos" | "gonderiliyor" | "tamam" | "hata">("bos");
  const [hata, setHata] = useState("");
  const [pilot, setPilot] = useState(true);

  async function gonder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDurum("gonderiliyor");
    const f = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
      const r = await fetch(`${API}/api/teklif`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, pilot }) });
      const j = (await r.json().catch(() => ({}))) as { hata?: string };
      if (!r.ok) throw new Error(j.hata ?? "");
      setDurum("tamam");
    } catch (h) {
      setHata(HATA[(h as Error).message] ?? "Gönderilemedi, lütfen tekrar deneyin.");
      setDurum("hata");
    }
  }

  if (durum === "tamam") {
    return (
      <div className="mesaj iyi" role="status">
        Teşekkürler! Talebinizi aldık; en geç bir iş günü içinde sizi arayacağız. {pilot ? "Pilot hesabınız görüşmenin ardından aynı gün açılır." : ""}
      </div>
    );
  }
  return (
    <form className="form" onSubmit={gonder}>
      <div className="secim tam" role="radiogroup" aria-label="Talep türü">
        <label><input type="radio" checked={pilot} onChange={() => setPilot(true)} /> 30 gün ücretsiz pilot</label>
        <label><input type="radio" checked={!pilot} onChange={() => setPilot(false)} /> Teklif / demo</label>
      </div>
      <label>Dershane adı<input name="dershane_adi" required maxLength={120} /></label>
      <label>Şehir<input name="sehir" required maxLength={60} /></label>
      <label>Şube sayısı<input name="sube_sayisi" type="number" min={1} defaultValue={1} /></label>
      <label>Öğrenci sayısı<input name="ogrenci_sayisi" type="number" min={1} defaultValue={100} /></label>
      <label>Yetkili adı<input name="yetkili" required maxLength={120} /></label>
      <label>Telefon<input name="telefon" type="tel" maxLength={30} /></label>
      <label className="tam">E-posta<input name="eposta" type="email" required maxLength={160} /></label>
      <label className="tam">Not<textarea name="not" rows={3} maxLength={1000} placeholder="Sınav grubu (LGS/YKS), başlamak istediğiniz tarih…" /></label>
      <input name="web_sitesi" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999 }} aria-hidden />
      {durum === "hata" && <div className="mesaj kotu tam">{hata}</div>}
      <button className="dugme ana tam" disabled={durum === "gonderiliyor"} style={{ justifyContent: "center" }}>
        {durum === "gonderiliyor" ? "Gönderiliyor…" : pilot ? "Pilotu başlat" : "Teklif iste"}
      </button>
      <p className="tam" style={{ color: "var(--soluk)", fontSize: 13, margin: 0 }}>Bilgileriniz yalnızca sizinle iletişim için kullanılır.</p>
    </form>
  );
}
