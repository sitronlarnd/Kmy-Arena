import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { onceKac } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
const ONC: Record<string, string> = { acil: "yanlis", yuksek: "altin", normal: "", dusuk: "" };

export default async function Destek() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.destek");
  const { data } = await servis().from("destek_talep").select("id, konu, oncelik, durum, olusturma, ilk_yanit, guncelleme, dershane:dershane_id(ad), atanan:atanan_id(ad)").order("durum").order("olusturma", { ascending: false }).limit(200);
  type T = { id: string; konu: string; oncelik: string; durum: string; olusturma: string; ilk_yanit: string | null; guncelleme: string; dershane: { ad: string } | null; atanan: { ad: string } | null };
  const l = (data ?? []) as unknown as T[];
  const yanitli = l.filter((x) => x.ilk_yanit);
  const ort = yanitli.length ? Math.round(yanitli.reduce((a, x) => a + (Date.parse(x.ilk_yanit ?? "") - Date.parse(x.olusturma)), 0) / yanitli.length / 3600000) : null;
  return (
    <PanelKabugu baslik="Destek talepleri" panel="merkez" aktif="/merkez/destek" yol={ort === null ? undefined : `Ortalama ilk yanıt süresi: ${ort} saat`}>
      <Kart genis>
        <table className="tablo"><thead><tr><th>Konu</th><th>Dershane</th><th>Öncelik</th><th>Durum</th><th>Atanan</th><th>Açıldı</th></tr></thead>
          <tbody>{l.length === 0 && <tr><td colSpan={6} className="bos">Talep yok.</td></tr>}
            {l.map((x) => (
              <tr key={x.id}><td><a href={`/merkez/destek/${x.id}`}><b>{x.konu}</b></a></td><td>{x.dershane?.ad}</td><td><span className={`rozet ${ONC[x.oncelik]}`}>{x.oncelik}</span></td>
                <td><span className={`rozet ${x.durum === "kapandi" ? "dogru" : x.durum === "acik" ? "altin" : ""}`}>{x.durum}</span></td><td>{x.atanan?.ad ?? "—"}</td><td className="soluk">{onceKac(x.olusturma)}</td></tr>
            ))}</tbody></table>
      </Kart>
    </PanelKabugu>
  );
}
