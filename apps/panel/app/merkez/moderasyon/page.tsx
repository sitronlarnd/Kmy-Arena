import { kelimeEkle, kelimeSil, kisitla, sikayetKarar } from "@/app/merkez/merkez-eylemleri";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
const SEBEP: Record<string, string> = { kufur: "Küfür", zorbalik: "Zorbalık", kisisel_bilgi: "Kişisel bilgi", spam: "Spam", uygunsuz: "Uygunsuz", diger: "Diğer" };

export default async function Moderasyon({ searchParams }: { searchParams: Promise<{ ara?: string }> }) {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.moderasyon");
  const { ara } = await searchParams;
  const s = servis();
  const [{ data: sikayetler }, { data: kelimeler }, { data: dershaneler }, { data: kisitli }, { data: bulunan }] = await Promise.all([
    s.from("sikayet").select("id, hedef_tur, hedef_id, sebep, aciklama, oncelikli, merkez_notu, olusturma, dershane:dershane_id(ad)").eq("merkeze_ilet", true).eq("durum", "acik").order("oncelikli", { ascending: false }).order("olusturma"),
    s.from("yasakli_kelime").select("id, kelime, dershane:dershane_id(ad)").order("kelime"),
    s.from("dershane").select("id, ad").eq("bireysel", false).order("ad"),
    s.from("kullanici").select("id, ad, soyad, takma_ad, sosyal_kisit_bitis, puan_donduruldu, kisit_gerekce, dershane:dershane_id(ad)").or("sosyal_kisit_bitis.gt.now(),puan_donduruldu.eq.true"),
    ara && ara.length >= 2 ? s.from("kullanici").select("id, ad, soyad, takma_ad, dershane:dershane_id(ad)").eq("tur", "ogrenci").or(`takma_ad.ilike.%${ara.replace(/[%,()]/g, "")}%,ad.ilike.%${ara.replace(/[%,()]/g, "")}%`).limit(20) : Promise.resolve({ data: [] }),
  ]);
  type K = { id: string; ad: string; soyad: string; takma_ad: string | null; dershane: { ad: string } | null };
  return (
    <PanelKabugu baslik="Moderasyon merkezi" panel="merkez" aktif="/merkez/moderasyon">
      <Kart genis baslik="Merkeze iletilen şikâyetler" aciklama="Dershanelerin çözemediği veya merkeze ilettiği şikâyetler; zorbalık ve kişisel bilgi en üstte.">
        <table className="tablo"><tbody>
          {(sikayetler ?? []).length === 0 && <tr><td className="bos">Bekleyen yok.</td></tr>}
          {((sikayetler ?? []) as unknown as { id: string; hedef_tur: string; sebep: string; aciklama: string | null; oncelikli: boolean; merkez_notu: string | null; olusturma: string; dershane: { ad: string } | null }[]).map((x) => (
            <tr key={x.id}><td>{x.oncelikli && <span className="rozet yanlis">öncelikli</span>} <b>{SEBEP[x.sebep]}</b> · {x.hedef_tur}<div className="kucuk soluk">{x.dershane?.ad} · {tarih(x.olusturma, true)}</div></td>
              <td className="kucuk">{x.aciklama}<div className="soluk">{x.merkez_notu}</div></td>
              <td><div className="form"><KayitDugmesi eylem={sikayetKarar.bind(null, x.id, "incelendi")} etiket="İşlem yapıldı" /><KayitDugmesi eylem={sikayetKarar.bind(null, x.id, "reddedildi")} etiket="Reddet" tur="ikincil" /></div></td></tr>
          ))}
        </tbody></table>
      </Kart>
      <Kart baslik="Yasaklı kelimeler" aciklama="Uygulamadaki yerleşik filtreye ek. Virgül veya satırla birden çok kelime; dershane seçilirse yalnız o dershanede.">
        <KayitFormu eylem={kelimeEkle} dugme="Ekle">
          <input name="kelime" required placeholder="kelime1, kelime2" className="alan" />
          <select name="dershane" className="alan"><option value="">Tüm dershaneler</option>{(dershaneler ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.ad as string}</option>)}</select>
        </KayitFormu>
        <div className="form" style={{ marginTop: 10 }}>{((kelimeler ?? []) as unknown as { id: number; kelime: string; dershane: { ad: string } | null }[]).map((x) => (
          <span key={x.id} className="rozet">{x.kelime}{x.dershane ? ` · ${x.dershane.ad}` : ""}<KayitDugmesi eylem={kelimeSil.bind(null, x.id)} etiket="×" tur="ikincil" /></span>
        ))}</div>
      </Kart>
      <Kart baslik="Hesap kısıtlama" aciklama="Sosyal özellikleri (topluluk, klan sohbeti) geçici kapatma ve puan dondurma. Her karar gerekçeli ve denetim kaydına yazılır.">
        <form className="form" method="get"><input name="ara" defaultValue={ara ?? ""} placeholder="Takma ad veya ad ara" className="alan" /><button className="dugme kucuk">Ara</button></form>
        {((bulunan ?? []) as unknown as K[]).map((k) => (
          <div key={k.id} className="kart" style={{ marginTop: 8 }}>
            <b>{k.ad} {k.soyad}</b> <span className="soluk">@{k.takma_ad} · {k.dershane?.ad}</span>
            <KayitFormu eylem={kisitla} dugme="Uygula">
              <input type="hidden" name="kullanici" value={k.id} />
              <label className="kucuk soluk">Sosyal kapatma (gün) <input name="gun" type="number" min={0} max={365} defaultValue={7} className="alan" style={{ width: 80 }} /></label>
              <label className="kucuk soluk" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" name="dondur" /> Puanı dondur</label>
              <input name="gerekce" required placeholder="Gerekçe" className="alan" style={{ minWidth: 240 }} />
            </KayitFormu>
          </div>
        ))}
        <h4 style={{ marginTop: 14 }}>Kısıtlı hesaplar</h4>
        {((kisitli ?? []) as unknown as (K & { sosyal_kisit_bitis: string | null; puan_donduruldu: boolean; kisit_gerekce: string | null })[]).map((k) => (
          <p key={k.id} className="kucuk"><b>{k.ad} {k.soyad}</b> · {k.dershane?.ad} · {k.sosyal_kisit_bitis ? `sosyal ${tarih(k.sosyal_kisit_bitis)} tarihine dek kapalı` : ""}{k.puan_donduruldu ? " · puan donduruldu" : ""} — {k.kisit_gerekce}</p>
        ))}
      </Kart>
    </PanelKabugu>
  );
}
