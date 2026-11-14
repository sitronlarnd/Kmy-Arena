import { KayitDugmesi } from "@/bilesenler/Kayit";
import { CizgiGrafik, Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc, tarih } from "@/lib/panel";
import { paneliKoru } from "@/lib/yetki";
import { denemeSil } from "./eylemler";
import { DenemeSihirbazi } from "./Sihirbaz";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface Egilim { id: string; ad: string; tarih: string; sinav: string; ortalama: number | null; katilim: number; subeler: Record<string, number> | null }

export default async function Deneme() {
  await paneliKoru("dershane");
  const l = await panelRpc<Egilim[]>("panel_net_egilimi", { p_sinav: null }).catch(() => [] as Egilim[]);
  const gruplar = [...new Set(l.map((x) => x.sinav))];
  return (
    <PanelKabugu baslik="Deneme sınavları" panel="dershane" aktif="/dershane/deneme" sag={<a className="dugme ikincil" href="/dershane/etki">Etki raporu</a>}>
      <Kart genis baslik="Sonuç yükle" aciklama="Optik okuyucunun Excel/CSV çıktısını yükleyin. Öğrenciler öğrenci numarası ya da ad-soyad ile eşleşir; ders net sütunları otomatik önerilir, gerekirse değiştirin.">
        <DenemeSihirbazi />
      </Kart>
      {gruplar.map((g) => {
        const x = l.filter((d) => d.sinav === g);
        return (
          <Kart key={g} genis baslik={`${g} net eğilimi`} aciklama="Deneme başına ortalama toplam net">
            {x.length > 1 && <CizgiGrafik veri={x.map((d) => Number(d.ortalama ?? 0))} etiketler={x.map((d) => d.ad)} />}
            <table className="tablo" style={{ marginTop: 10 }}>
              <thead><tr><th>Deneme</th><th>Tarih</th><th>Katılım</th><th>Ortalama net</th><th>Şubeler</th><th /></tr></thead>
              <tbody>{[...x].reverse().map((d) => (
                <tr key={d.id}><td><a href={`/dershane/deneme/${d.id}`}><b>{d.ad}</b></a></td><td>{tarih(d.tarih)}</td><td>{d.katilim}</td><td>{d.ortalama}</td>
                  <td className="kucuk">{Object.entries(d.subeler ?? {}).map(([s, n]) => `${s}: ${n}`).join(" · ")}</td>
                  <td><KayitDugmesi eylem={denemeSil.bind(null, d.id)} etiket="Sil" tur="ikincil" onay="Emin misin?" /></td></tr>
              ))}</tbody>
            </table>
          </Kart>
        );
      })}
    </PanelKabugu>
  );
}
