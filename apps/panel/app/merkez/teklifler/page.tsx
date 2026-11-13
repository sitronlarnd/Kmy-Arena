import { teklifGuncelle } from "@/app/merkez/eylemler";
import { Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

const DURUM: Record<string, [string, string]> = {
  yeni: ["Yeni", "altin"], gorusuldu: ["Görüşüldü", "vurgu"], demo_yapildi: ["Demo yapıldı", "vurgu"], pilot: ["Pilot", "vurgu"],
  teklif_verildi: ["Teklif verildi", "altin"], kazanildi: ["Kazanıldı", "dogru"], kaybedildi: ["Kaybedildi", "yanlis"],
};

interface Teklif { id: string; dershane_adi: string; sehir: string; sube_sayisi: number | null; ogrenci_sayisi: number | null; yetkili: string; telefon: string | null; eposta: string; not: string | null; pilot_talebi: boolean; durum: string; sonraki_adim_tarihi: string | null; olusturma: string }

export default async function Teklifler() {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.satis");
  const { data } = await servis().from("teklif").select("*").order("olusturma", { ascending: false }).limit(200);
  const l = (data ?? []) as Teklif[];
  const say = (d: string) => l.filter((x) => x.durum === d).length;
  const bugun = new Date().toISOString().slice(0, 10);
  return (
    <PanelKabugu baslik="Teklifler ve pilotlar" panel="merkez" aktif="/merkez/teklifler">
      <Metrik deger={say("yeni")} etiket="Yeni talep" renk="#f5a400" ikon="✉" />
      <Metrik deger={say("pilot")} etiket="Pilotta" renk="#7c5cfa" ikon="◎" />
      <Metrik deger={say("kazanildi")} etiket="Kazanıldı" renk="#12b76a" ikon="✓" />
      <Metrik deger={l.filter((x) => x.sonraki_adim_tarihi && x.sonraki_adim_tarihi <= bugun && !["kazanildi", "kaybedildi"].includes(x.durum)).length} etiket="Bugün aranacak" renk="#e5354f" ikon="!" />
      <Kart genis baslik="Huni" aciklama="Yeni → Görüşüldü → Demo yapıldı → Pilot → Teklif verildi → Kazanıldı / Kaybedildi">
        <div className="kaydir" style={{ marginTop: 12 }}>
          <table className="tablo">
            <thead><tr><th>Dershane</th><th>Yetkili</th><th>Büyüklük</th><th>Talep</th><th>Durum ve sonraki adım</th></tr></thead>
            <tbody>
              {l.length === 0 && <tr><td colSpan={5} className="bos">Henüz talep yok. Tanıtım sitesindeki form buraya düşer.</td></tr>}
              {l.map((x) => (
                <tr key={x.id}>
                  <td><b>{x.dershane_adi}</b><div className="soluk kucuk">{x.sehir} · {tarih(x.olusturma, true)}</div>{x.not && <div className="kucuk" style={{ maxWidth: 280 }}>{x.not}</div>}</td>
                  <td>{x.yetkili}<div className="soluk kucuk"><a href={`mailto:${x.eposta}`}>{x.eposta}</a>{x.telefon ? ` · ${x.telefon}` : ""}</div></td>
                  <td>{x.sube_sayisi ?? "?"} şube · {x.ogrenci_sayisi ?? "?"} öğr.</td>
                  <td><span className={`rozet ${x.pilot_talebi ? "vurgu" : ""}`}>{x.pilot_talebi ? "Pilot" : "Teklif"}</span></td>
                  <td>
                    <form action={teklifGuncelle} className="form">
                      <input type="hidden" name="id" value={x.id} />
                      <span className={`rozet ${DURUM[x.durum]?.[1] ?? ""}`}>{DURUM[x.durum]?.[0] ?? x.durum}</span>
                      <select name="durum" defaultValue={x.durum} className="alan">{Object.entries(DURUM).map(([k, [a]]) => <option key={k} value={k}>{a}</option>)}</select>
                      <input type="date" name="sonraki" defaultValue={x.sonraki_adim_tarihi ?? ""} className="alan" />
                      <button className="dugme kucuk">Kaydet</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
