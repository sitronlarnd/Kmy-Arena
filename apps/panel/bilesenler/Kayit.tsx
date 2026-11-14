"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";

/** Giriş kartları / veli kodları: yazdırılabilir liste (şifreler bir kez gösterilir, saklanmaz). */
export function SonucListesi({ s }: { s: KayitSonucu }) {
  return (
    <>
      {s.tamam && <span className="bilgi">{s.tamam}</span>}
      {s.hata && <span className="hata">{s.hata}</span>}
      {!!s.hatalar?.length && (
        <details className="kucuk" open={s.hatalar.length < 6}>
          <summary className="hata">{s.hatalar.length} satır atlandı</summary>
          <ul>{s.hatalar.map((h) => <li key={h}>{h}</li>)}</ul>
        </details>
      )}
      {!!s.hesaplar?.length && (
        <div className="yazdir-alan">
          <div className="form" style={{ justifyContent: "space-between" }}>
            <b>Giriş bilgileri — şifreler yalnızca şimdi gösterilir</b>
            <button type="button" className="dugme kucuk" onClick={() => window.print()}>Giriş kartlarını yazdır</button>
          </div>
          <div className="giris-kartlari">
            {s.hesaplar.map((h) => (
              <div key={h.id} className="giris-karti">
                <b>{h.ad} {h.soyad}</b>
                <span>Kullanıcı adı: <code>{h.giris}</code></span>
                <span>Geçici şifre: <code>{h.sifre}</code></span>
                <small>KMY Arena uygulamasını indir, bu bilgilerle giriş yap; ilk girişte kendi şifreni belirle.</small>
              </div>
            ))}
          </div>
        </div>
      )}
      {!!s.kodlar?.length && (
        <div className="yazdir-alan">
          <div className="form" style={{ justifyContent: "space-between" }}>
            <b>Veli davet kodları</b>
            <button type="button" className="dugme kucuk" onClick={() => window.print()}>Veli kartlarını yazdır</button>
          </div>
          <div className="giris-kartlari">
            {s.kodlar.map((k) => (
              <div key={k.kod} className="giris-karti">
                <b>{k.ad} {k.soyad} — velisi için</b>
                <span>Davet kodu: <code>{k.kod}</code></span>
                <small>KMY Arena uygulamasını indirin, “Davet koduyla katıl” deyip bu kodu girin. Çocuğunuzun haftalık gelişimini görürsünüz.</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export function KayitFormu({ eylem, children, dugme, dosya }: { eylem: (o: KayitSonucu, f: FormData) => Promise<KayitSonucu>; children: ReactNode; dugme: string; dosya?: boolean }) {
  const [durum, gonder, bekliyor] = useActionState(eylem, {});
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <form action={gonder} className="form" encType={dosya ? "multipart/form-data" : undefined}>
        {children}
        <button className="dugme" type="submit" disabled={bekliyor}>{bekliyor ? "İşleniyor…" : dugme}</button>
      </form>
      <SonucListesi s={durum} />
    </div>
  );
}

export function KayitDugmesi({ eylem, etiket, tur, onay }: { eylem: () => Promise<KayitSonucu>; etiket: string; tur?: string; onay?: string }) {
  const [bekliyor, basla] = useTransition();
  const [sonuc, setSonuc] = useState<KayitSonucu | null>(null);
  const [soruldu, setSoruldu] = useState(false);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <button type="button" className={`dugme kucuk ${tur ?? ""}`} disabled={bekliyor}
        onClick={() => { if (onay && !soruldu) { setSoruldu(true); return; } basla(async () => { setSonuc(await eylem()); setSoruldu(false); }); }}>
        {bekliyor ? "…" : soruldu ? onay : etiket}
      </button>
      {sonuc && <SonucListesi s={sonuc} />}
    </div>
  );
}
