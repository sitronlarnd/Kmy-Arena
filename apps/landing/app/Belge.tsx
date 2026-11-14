import type { ReactNode } from "react";

/** Hukuki metinlerde tek yerden değiştirilecek iletişim bilgisi. */
export const ILETISIM = {
  unvan: process.env.NEXT_PUBLIC_SIRKET_UNVANI ?? "KMYAI",
  eposta: process.env.NEXT_PUBLIC_DESTEK_EPOSTA ?? "destek@kmyai.cloud",
};

export function Belge({ baslik, guncelleme, children }: { baslik: string; guncelleme: string; children: ReactNode }) {
  return (
    <>
      <header className="ust">
        <div className="kap">
          <a href="/" className="logo"><img src="/logo.svg" alt="" width={36} height={36} />KMY Arena</a>
          <nav aria-label="Belgeler"><a href="/gizlilik">Gizlilik</a><a href="/kosullar">Kullanım koşulları</a><a href="/hesap-silme">Hesap silme</a></nav>
        </div>
      </header>
      <main className="kap belge">
        <h1>{baslik}</h1>
        <p className="soluk">Son güncelleme: {guncelleme}</p>
        {children}
      </main>
      <footer><div className="kap"><span>© {new Date().getFullYear()} KMY Arena</span><span><a href="/">Ana sayfa</a> · <a href={`mailto:${ILETISIM.eposta}`}>{ILETISIM.eposta}</a></span></div></footer>
    </>
  );
}
