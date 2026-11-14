import { DersSec } from "@/bilesenler/DersSec";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { dersListesi } from "@/lib/mufredat";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";
import { etkinlikEkle, etkinlikSil, odulEkle, teslimEt } from "./eylemler";

export const dynamic = "force-dynamic";

const KAYNAK: Record<string, string> = { turnuva: "Turnuva", sezon: "Sezon / ay", etkinlik: "Etkinlik", diger: "Diğer" };
const TUR: Record<string, string> = { turnuva: "Turnuva", canli: "Canlı yarışma", deneme: "Deneme", diger: "Diğer" };

export default async function Odul() {
  await paneliKoru("dershane");
  const k = await yetkiIste("odul.yonet");
  const s = await sunucuIstemcisi();
  const [{ data: etkinlikler }, { data: oduller }, { data: oneriler }, { data: siniflar }, { data: ogrenciler }, dersler] = await Promise.all([
    s.from("etkinlik").select("id, ad, tur, baslangic, bitis, odul, sinif_ids").order("baslangic", { ascending: false }).limit(30),
    s.from("odul").select("id, kaynak, baslik, odul, teslim, olusturma, kazanan:kazanan_id(ad, soyad)").order("olusturma", { ascending: false }).limit(100),
    s.rpc("panel_odul_onerileri"),
    servis().from("sinif").select("id, ad").eq("dershane_id", k.dershaneId).eq("arsiv", false).order("ad"),
    servis().from("kullanici").select("id, ad, soyad").eq("dershane_id", k.dershaneId).eq("tur", "ogrenci").is("silinme_talebi", null).order("ad"),
    dersListesi(),
  ]);
  const sinifAd = new Map((siniflar ?? []).map((c) => [c.id as string, c.ad as string]));
  return (
    <PanelKabugu baslik="Etkinlikler ve ödüller" panel="dershane" aktif="/dershane/odul">
      <Kart genis baslik="Etkinlik oluştur" aciklama="Dershane içi turnuva, canlı yarışma, deneme günü ya da tematik hafta. Seçili sınıflardaki öğrenciler Arena ekranında görür. Sınıf turnuvaları öğretmen panelinden başlatılır.">
        <KayitFormu eylem={etkinlikEkle} dugme="Ekle">
          <input name="ad" required placeholder="Etkinlik adı" className="alan" />
          <select name="tur" className="alan">{Object.entries(TUR).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
          <label className="kucuk soluk">Başlangıç <input name="baslangic" type="datetime-local" required className="alan" /></label>
          <label className="kucuk soluk">Bitiş <input name="bitis" type="datetime-local" className="alan" /></label>
          <DersSec dersler={dersler} />
          <select name="sinif" multiple className="alan" style={{ minHeight: 80 }} title="Boş = tüm dershane">{(siniflar ?? []).map((c) => <option key={c.id as string} value={c.id as string}>{c.ad as string}</option>)}</select>
          <input name="odul" placeholder="Ödül" className="alan" />
          <input name="aciklama" placeholder="Açıklama" className="alan" style={{ minWidth: 260 }} />
        </KayitFormu>
      </Kart>
      <Kart genis baslik="Etkinlikler">
        <table className="tablo"><tbody>
          {(etkinlikler ?? []).length === 0 && <tr><td className="bos">Henüz etkinlik yok.</td></tr>}
          {(etkinlikler ?? []).map((e) => (
            <tr key={e.id as string}><td><b>{e.ad as string}</b> <span className="rozet">{TUR[e.tur as string]}</span></td><td>{tarih(e.baslangic as string, true)}{e.bitis ? ` – ${tarih(e.bitis as string, true)}` : ""}</td>
              <td className="kucuk">{(e.sinif_ids as string[] | null)?.map((x) => sinifAd.get(x)).join(", ") ?? "Tüm dershane"}</td><td>{(e.odul as string) ?? ""}</td>
              <td><KayitDugmesi eylem={etkinlikSil.bind(null, e.id as string)} etiket="Sil" tur="ikincil" onay="Emin misin?" /></td></tr>
          ))}
        </tbody></table>
      </Kart>
      <Kart baslik="Ödül ver" aciklama="Sezon/ay birincileri, etkinlik kazananları… Turnuva şampiyonları ödül tanımlıysa listeye kendiliğinden düşer.">
        <KayitFormu eylem={odulEkle} dugme="Kaydet">
          <select name="kaynak" className="alan">{Object.entries(KAYNAK).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
          <input name="baslik" required placeholder="Başlık (ör. Kasım ayının öğrencisi)" className="alan" />
          <select name="kazanan" required className="alan">{(ogrenciler ?? []).map((o) => <option key={o.id as string} value={o.id as string}>{o.ad as string} {o.soyad as string}</option>)}</select>
          <input name="odul" required placeholder="Ödül" className="alan" />
        </KayitFormu>
      </Kart>
      <Kart baslik="Bu ayın sınıf birincileri (öneri)" aciklama="Ligde bu ay en çok XP kazanan öğrenci">
        <table className="tablo"><tbody>{((oneriler ?? []) as { sinif: string; ad: string; xp: number }[]).map((x) => <tr key={x.sinif}><td>{x.sinif}</td><td><b>{x.ad}</b></td><td>{x.xp} XP</td></tr>)}</tbody></table>
      </Kart>
      <Kart genis baslik="Kazananlar ve teslim takibi">
        <table className="tablo">
          <thead><tr><th>Kazanan</th><th>Başlık</th><th>Kaynak</th><th>Ödül</th><th>Durum</th></tr></thead>
          <tbody>
            {(oduller ?? []).length === 0 && <tr><td colSpan={5} className="bos">Henüz ödül yok.</td></tr>}
            {((oduller ?? []) as unknown as { id: string; kaynak: string; baslik: string; odul: string; teslim: string | null; olusturma: string; kazanan: { ad: string; soyad: string } | null }[]).map((o) => (
              <tr key={o.id}><td><b>{o.kazanan ? `${o.kazanan.ad} ${o.kazanan.soyad}` : "—"}</b></td><td>{o.baslik}</td><td>{KAYNAK[o.kaynak]}</td><td>{o.odul}</td>
                <td>{o.teslim ? <span className="rozet dogru">Teslim {tarih(o.teslim)}</span> : <KayitDugmesi eylem={teslimEt.bind(null, o.id, true)} etiket="Teslim edildi" />}</td></tr>
            ))}
          </tbody>
        </table>
      </Kart>
    </PanelKabugu>
  );
}
