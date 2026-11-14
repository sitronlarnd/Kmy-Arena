import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { tarih } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";
import { talepAc, talepYaz } from "./eylemler";

export const dynamic = "force-dynamic";

export default async function Destek() {
  await paneliKoru("dershane");
  await yetkiIste("destek.talep");
  const s = await sunucuIstemcisi();
  const [{ data: talepler }, { data: mesajlar }, { data: faturalar }] = await Promise.all([
    s.from("destek_talep").select("id, konu, durum, oncelik, olusturma").order("olusturma", { ascending: false }).limit(30),
    s.from("destek_mesaj").select("talep_id, metin, merkez, olusturma").order("olusturma"),
    s.from("fatura").select("id, donem, tutar, vade, durum, odeme_tarihi").order("vade", { ascending: false }).limit(24),
  ]);
  const bugun = new Date().toISOString().slice(0, 10);
  return (
    <PanelKabugu baslik="Destek, lisans ve faturalar" panel="dershane" aktif="/dershane/destek">
      <Kart baslik="Merkeze destek talebi aç">
        <KayitFormu eylem={talepAc} dugme="Gönder">
          <input name="konu" required placeholder="Konu" className="alan" />
          <select name="oncelik" className="alan" defaultValue="normal"><option value="dusuk">Düşük</option><option value="normal">Normal</option><option value="yuksek">Yüksek</option><option value="acil">Acil</option></select>
          <textarea name="metin" required rows={4} placeholder="Sorunu anlatın" className="alan" style={{ width: "100%" }} />
        </KayitFormu>
      </Kart>
      <Kart baslik="Faturalar">
        <table className="tablo"><tbody>
          {(faturalar ?? []).length === 0 && <tr><td className="bos">Fatura yok.</td></tr>}
          {(faturalar ?? []).map((f) => (
            <tr key={f.id as string}><td>{f.donem as string}</td><td>{Number(f.tutar).toLocaleString("tr-TR")} ₺</td><td>{tarih(f.vade as string)}</td>
              <td>{f.durum === "odendi" ? <span className="rozet dogru">Ödendi</span> : (f.vade as string) < bugun ? <span className="rozet yanlis">Gecikti</span> : <span className="rozet altin">Bekliyor</span>}</td></tr>
          ))}
        </tbody></table>
      </Kart>
      {(talepler ?? []).map((t) => (
        <Kart key={t.id as string} genis baslik={t.konu as string} aciklama={`${tarih(t.olusturma as string, true)} · ${t.durum as string}`}>
          {(mesajlar ?? []).filter((x) => x.talep_id === t.id).map((x, i) => (
            <p key={i} style={{ whiteSpace: "pre-wrap", color: "var(--metin)", margin: "8px 0", paddingLeft: x.merkez ? 0 : 0 }}><b className={x.merkez ? "" : "soluk"}>{x.merkez ? "Merkez" : "Siz"}:</b> {x.metin as string}</p>
          ))}
          {t.durum !== "kapandi" && (
            <KayitFormu eylem={talepYaz} dugme="Gönder">
              <input type="hidden" name="talep" value={t.id as string} />
              <input name="metin" placeholder="Yanıt yazın" className="alan" style={{ flex: 1, minWidth: 260 }} />
              <label className="kucuk soluk" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="kapat" /> Talebi kapat</label>
            </KayitFormu>
          )}
        </Kart>
      ))}
    </PanelKabugu>
  );
}
