import { t } from "@kmy/shared/i18n";
import type { ReactNode } from "react";

export function PanelKabugu({ baslik, children }: { baslik: string; children: ReactNode }) {
  return (
    <div className="kabuk">
      <header className="ust">
        <strong>{t("uygulama.ad")}</strong>
        <span>{baslik}</span>
        <a href="/cikis">{t("giris.cikisYap")}</a>
      </header>
      <main className="icerik">{children}</main>
    </div>
  );
}

export function Kart({ baslik, aciklama }: { baslik: string; aciklama: string }) {
  return (
    <section className="kart">
      <h3>{baslik}</h3>
      <p>{aciklama}</p>
    </section>
  );
}
