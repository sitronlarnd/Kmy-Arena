"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { EylemSonucu } from "@/app/ogretmen/eylemler";

/** Tek tık eylem düğmesi (server action) — sonuç mesajını gösterir. */
export function EylemDugmesi({ eylem, etiket, tur }: { eylem: () => Promise<EylemSonucu>; etiket: string; tur?: string }) {
  const [bekliyor, basla] = useTransition();
  const [sonuc, setSonuc] = useState<EylemSonucu | null>(null);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button className={`dugme ${tur ?? ""}`} disabled={bekliyor} onClick={() => basla(async () => setSonuc(await eylem()))}>
        {bekliyor ? "İşleniyor…" : etiket}
      </button>
      {sonuc?.tamam && <span className="bilgi">{sonuc.tamam}</span>}
      {sonuc?.hata && <span className="hata">{sonuc.hata}</span>}
    </div>
  );
}

/** Server action'lı form: sonuç mesajı ile. */
export function EylemFormu({ eylem, children, dugme, dikey = true }: { eylem: (o: EylemSonucu, f: FormData) => Promise<EylemSonucu>; children: ReactNode; dugme: string; dikey?: boolean }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, {});
  return (
    <form action={gonder} className={`form${dikey ? " dikey" : ""}`}>
      {children}
      <button className="dugme" type="submit" disabled={bekliyor}>{bekliyor ? "Gönderiliyor…" : dugme}</button>
      {durum.tamam && <span className="bilgi">{durum.tamam}</span>}
      {durum.hata && <span className="hata">{durum.hata}</span>}
    </form>
  );
}
