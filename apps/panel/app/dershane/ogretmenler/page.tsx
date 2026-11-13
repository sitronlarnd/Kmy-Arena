import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { onceKac, panelRpc } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Ogretmen { id: string; ad: string; son_giris: string | null; siniflar: string[]; odev30: number; onay30: number; sinif_aktiflik: number | null }

export default async function Ogretmenler() {
  await paneliKoru("dershane");
  const l = await panelRpc<Ogretmen[]>("panel_ogretmenler");
  return (
    <PanelKabugu baslik="Öğretmenler" panel="dershane" aktif="/dershane/ogretmenler">
      <Kart genis aciklama="Son 30 gün: verilen ödev, topluluk onayı ve sınıflarının haftalık aktiflik oranı.">
        <div className="kaydir" style={{ marginTop: 12 }}>
          <table className="tablo">
            <thead><tr><th>Öğretmen</th><th>Sınıflar</th><th>Ödev (30 g)</th><th>Topluluk onayı (30 g)</th><th>Sınıf aktifliği</th><th>Son giriş</th></tr></thead>
            <tbody>
              {l.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.ad}</b></td>
                  <td>{o.siniflar.map((s) => <span key={s} className="rozet" style={{ marginRight: 4 }}>{s}</span>)}</td>
                  <td>{o.odev30}</td>
                  <td>{o.onay30}</td>
                  <td>{o.sinif_aktiflik === null ? "—" : <span className={`rozet ${o.sinif_aktiflik >= 60 ? "dogru" : o.sinif_aktiflik >= 30 ? "altin" : "yanlis"}`}>%{o.sinif_aktiflik}</span>}</td>
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
