import { DersSec } from "@/bilesenler/DersSec";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { dersListesi } from "@/lib/mufredat";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { canliBaslat } from "./eylemler";

export const dynamic = "force-dynamic";

export default async function Canli() {
  await paneliKoru("ogretmen");
  const k = await yetkiIste("odev.yonet");
  const [{ data: siniflar }, dersler, { data: oturumlar }] = await Promise.all([
    servis().from("sinif_uyelik").select("sinif:sinif_id(id, ad, sinav_turu)").eq("kullanici_id", k.kullaniciId).eq("rol", "ogretmen"),
    dersListesi(),
    servis().from("canli_oturum").select("id, ad, pin, baslangic, sinif:sinif_id(ad)").eq("olusturan_id", k.kullaniciId).order("baslangic", { ascending: false }).limit(10),
  ]);
  const sl = ((siniflar ?? []) as unknown as { sinif: { id: string; ad: string; sinav_turu: string } | null }[]).flatMap((x) => (x.sinif ? [x.sinif] : []));
  return (
    <PanelKabugu baslik="Canlı sınıf yarışması" panel="ogretmen" aktif="/ogretmen/canli">
      <Kart genis baslik="Yarışma başlat" aciklama="Ekranı projeksiyona yansıtın; öğrenciler uygulamada Canlı › PIN ile katılır. Yarışma 1 dakika sonra başlar; her soru için süre bitince doğru cevap ve sıralama görünür. Arşivinizdeki sorularla başlatmak için Soru arşivim sayfasında soru seçin.">
        <KayitFormu eylem={canliBaslat} dugme="Başlat ve ekranı aç">
          <input name="ad" placeholder="Yarışma adı (isteğe bağlı)" className="alan" />
          <select name="sinif" required className="alan">{sl.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
          <DersSec dersler={dersler} />
          <label className="kucuk soluk">Soru <input name="adet" type="number" min={3} max={15} defaultValue={10} className="alan" style={{ width: 70 }} /></label>
          <label className="kucuk soluk">Süre (sn) <input name="sure" type="number" min={15} max={120} defaultValue={40} className="alan" style={{ width: 80 }} /></label>
        </KayitFormu>
      </Kart>
      <Kart genis baslik="Son yarışmalar">
        <table className="tablo"><tbody>
          {(oturumlar ?? []).length === 0 && <tr><td className="bos">Henüz yarışma yok.</td></tr>}
          {((oturumlar ?? []) as unknown as { id: string; ad: string | null; pin: string | null; baslangic: string; sinif: { ad: string } | null }[]).map((o) => (
            <tr key={o.id}><td><b>{o.ad ?? "Canlı yarışma"}</b> <span className="soluk">{o.sinif?.ad}</span></td><td>{tarih(o.baslangic, true)}</td><td>PIN {o.pin}</td><td><a href={`/ogretmen/canli/${o.id}`}>Ekranı aç</a></td></tr>
          ))}
        </tbody></table>
      </Kart>
    </PanelKabugu>
  );
}
