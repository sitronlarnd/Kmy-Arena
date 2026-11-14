import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { onceKac, panelRpc } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Ogretmen { id: string; ad: string; son_giris: string | null; siniflar: string[]; odev30: number; onay30: number; sinif_aktiflik: number | null; soru30: number; cozum: number; anlatim: number; turnuva30: number; yanit_dk: number | null; sinif_gelisim: number | null }

export default async function Ogretmenler() {
  await paneliKoru("dershane");
  const l = await panelRpc<Ogretmen[]>("panel_ogretmenler");
  return (
    <PanelKabugu baslik="Öğretmenler" panel="dershane" aktif="/dershane/ogretmenler">
      {l.filter((o) => o.odev30 + o.soru30 + o.turnuva30 === 0).length > 0 && (
        <Kart genis baslik="Destek önerisi" aciklama="Amaç denetim değil destek. Son 30 günde sistemi kullanmayan öğretmenlere 10 dakikalık kısa tanıtım önerilir: tek tıkla zayıf konulara ödev, sınıf analizi ısı haritası ve canlı yarışma.">
          <p style={{ marginTop: 8 }}>{l.filter((o) => o.odev30 + o.soru30 + o.turnuva30 === 0).map((o) => o.ad).join(", ")}</p>
          <ul className="kucuk soluk" style={{ marginTop: 6 }}>
            <li>Sınıflarım › sınıf › “Zayıf konulara ödev” düğmesi tek tıkla 10 soruluk uyarlamalı ödev verir.</li>
            <li>Canlı yarışma derse 10 dakikalık enerjik bir açılış sağlar; projeksiyona yansıtmak yeterli.</li>
            <li>Soru arşivinde fotoğraftan soru okuma, kâğıttaki soruları dakikalar içinde dijitale taşır.</li>
          </ul>
        </Kart>
      )}
      <Kart genis aciklama="Son 30 gün: verilen ödev, yüklenen soru, çözüm ve konu anlatımı, turnuva/canlı yarışma, topluluk onayı ve ortalama yanıt süresi; sınıflarının haftalık aktiflik oranı ve beceri gelişimi. Atamalar için Ekip ve roller sayfası.">
        <div className="kaydir" style={{ marginTop: 12 }}>
          <table className="tablo">
            <thead><tr><th>Öğretmen</th><th>Sınıflar</th><th>Ödev</th><th>Soru</th><th>Çözüm / anlatım</th><th>Turnuva / canlı</th><th>Topluluk onayı</th><th>Yanıt süresi</th><th>Sınıf aktifliği</th><th>Gelişim</th><th>Son giriş</th></tr></thead>
            <tbody>
              {l.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.ad}</b></td>
                  <td>{o.siniflar.map((s) => <span key={s} className="rozet" style={{ marginRight: 4 }}>{s}</span>)}</td>
                  <td>{o.odev30}</td>
                  <td>{o.soru30}</td>
                  <td>{o.cozum} / {o.anlatim}</td>
                  <td>{o.turnuva30}</td>
                  <td>{o.onay30}</td>
                  <td>{o.yanit_dk === null ? "—" : o.yanit_dk < 60 ? `${o.yanit_dk} dk` : `${Math.round(o.yanit_dk / 60)} sa`}</td>
                  <td>{o.sinif_aktiflik === null ? "—" : <span className={`rozet ${o.sinif_aktiflik >= 60 ? "dogru" : o.sinif_aktiflik >= 30 ? "altin" : "yanlis"}`}>%{o.sinif_aktiflik}</span>}</td>
                  <td>{o.sinif_gelisim === null ? "—" : <span className={`rozet ${o.sinif_gelisim >= 0 ? "dogru" : "yanlis"}`}>{o.sinif_gelisim >= 0 ? "+" : ""}{o.sinif_gelisim}</span>}</td>
                  <td className="soluk">{onceKac(o.son_giris)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
