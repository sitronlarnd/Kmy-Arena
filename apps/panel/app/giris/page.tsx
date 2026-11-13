"use client";

import { t } from "@kmy/shared/i18n";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { tarayiciIstemcisi } from "@/lib/supabase";

export default function Giris() {
  const yonlendir = useRouter();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function gonder(e: FormEvent) {
    e.preventDefault();
    setBekliyor(true);
    setHata(null);
    const { error } = await tarayiciIstemcisi().auth.signInWithPassword({ email: eposta, password: sifre });
    setBekliyor(false);
    if (error) return setHata(t("ortak.hata"));
    yonlendir.replace("/");
    yonlendir.refresh();
  }

  return (
    <form className="giris" onSubmit={gonder}>
      <h1>{t("uygulama.ad")}</h1>
      <input type="email" autoComplete="email" placeholder={t("giris.epostaEtiket")} value={eposta} onChange={(e) => setEposta(e.target.value)} required />
      <input type="password" autoComplete="current-password" placeholder={t("giris.sifreEtiket")} value={sifre} onChange={(e) => setSifre(e.target.value)} required />
      {hata && <p className="hata">{hata}</p>}
      <button type="submit" disabled={bekliyor}>{bekliyor ? t("ortak.yukleniyor") : t("giris.girisYap")}</button>
    </form>
  );
}
