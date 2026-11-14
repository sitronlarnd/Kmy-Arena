"use client";

import { useEffect, useState } from "react";
import { tarayiciIstemcisi } from "@/lib/supabase";

/** Merkez paneli için iki adımlı doğrulama (TOTP): ilk girişte kurulum, sonra her oturumda kod. */
export default function IkiAdim() {
  const [kur, setKur] = useState<{ id: string; qr: string; gizli: string } | null>(null);
  const [faktor, setFaktor] = useState<string | null>(null);
  const [kod, setKod] = useState("");
  const [hata, setHata] = useState("");
  const [bekliyor, setBekliyor] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = tarayiciIstemcisi();
      const { data, error } = await s.auth.mfa.listFactors();
      if (error) { setHata(error.message); return; }
      const dogrulanmis = data.totp.find((f) => f.status === "verified");
      if (dogrulanmis) { setFaktor(dogrulanmis.id); return; }
      for (const f of data.all.filter((x) => x.status === "unverified")) await s.auth.mfa.unenroll({ factorId: f.id });
      const r = await s.auth.mfa.enroll({ factorType: "totp", friendlyName: `KMY Arena Merkez ${new Date().toISOString().slice(0, 10)}` });
      if (r.error) { setHata(`İki adımlı doğrulama kurulamadı: ${r.error.message}. Supabase › Authentication › MFA bölümünde TOTP'nin açık olduğundan emin olun.`); return; }
      setKur({ id: r.data.id, qr: r.data.totp.qr_code, gizli: r.data.totp.secret });
    })();
  }, []);

  async function dogrula() {
    const id = faktor ?? kur?.id;
    if (!id || !/^\d{6}$/.test(kod)) { setHata("6 haneli kodu girin."); return; }
    setBekliyor(true); setHata("");
    const { error } = await tarayiciIstemcisi().auth.mfa.challengeAndVerify({ factorId: id, code: kod });
    setBekliyor(false);
    if (error) { setHata("Kod hatalı ya da süresi geçti."); return; }
    window.location.href = "/merkez";
  }

  return (
    <div className="giris-sayfa" style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 20 }}>
      <div className="kart" style={{ maxWidth: 420, width: "100%", display: "grid", gap: 14 }}>
        <h2 style={{ margin: 0 }}>İki adımlı doğrulama</h2>
        {kur && (
          <>
            <p>Merkez paneli için kimlik doğrulayıcı uygulaması (Google Authenticator, Microsoft Authenticator, 1Password…) ile bu kodu tarayın:</p>
            <img src={kur.qr} alt="QR kod" width={200} height={200} style={{ background: "#fff", borderRadius: 12, padding: 8, justifySelf: "center" }} />
            <p className="kucuk soluk">Tarayamıyorsanız anahtar: <code>{kur.gizli}</code></p>
          </>
        )}
        {(kur || faktor) && (
          <>
            <p>{faktor ? "Uygulamanızdaki 6 haneli kodu girin." : "Uygulamanın gösterdiği 6 haneli kodu girin."}</p>
            <input className="alan" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={kod} onChange={(e) => setKod(e.target.value.replace(/\D/g, ""))} style={{ fontSize: 24, letterSpacing: 6, textAlign: "center" }} />
            <button className="dugme" disabled={bekliyor} onClick={() => void dogrula()}>{bekliyor ? "Doğrulanıyor…" : "Doğrula"}</button>
          </>
        )}
        {hata && <span className="hata">{hata}</span>}
        <a href="/cikis" className="kucuk">Çıkış yap</a>
      </div>
    </div>
  );
}
