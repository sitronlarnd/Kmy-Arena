import { KayitDugmesi } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { kazanimListesi } from "@/lib/mufredat";
import { tarih } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";
import { konuSil } from "./eylemler";
import { KonuFormu } from "./KonuFormu";

export const dynamic = "force-dynamic";

export default async function Konu() {
  await paneliKoru("ogretmen");
  const k = await yetkiIste("soru.yukle");
  const s = await sunucuIstemcisi();
  const [{ data }, kazanimlar] = await Promise.all([
    s.from("konu_anlatimi").select("id, baslik, tur, izlenme, olusturma, ogretmen_id, kazanim:kazanim_id(kod)").order("olusturma", { ascending: false }).limit(100),
    kazanimListesi(),
  ]);
  return (
    <PanelKabugu baslik="Konu anlatımlarım" panel="ogretmen" aktif="/ogretmen/konu">
      <Kart baslik="Yeni konu anlatımı" aciklama="Bir kazanıma video, bağlantı ya da yazılı anlatım ekleyin. O kazanımda AI sorusu çözen öğrencileriniz çözümün altında “Hocanın konu anlatımı” kartını görür.">
        <KonuFormu kazanimlar={kazanimlar} />
      </Kart>
      <Kart genis baslik="Dershanedeki anlatımlar">
        <table className="tablo">
          <thead><tr><th>Kazanım</th><th>Başlık</th><th>Tür</th><th>Tarih</th><th /></tr></thead>
          <tbody>
            {(data ?? []).length === 0 && <tr><td colSpan={5} className="bos">Henüz yok.</td></tr>}
            {((data ?? []) as unknown as { id: string; baslik: string; tur: string; olusturma: string; ogretmen_id: string; kazanim: { kod: string } | null }[]).map((x) => (
              <tr key={x.id}><td>{x.kazanim?.kod}</td><td><b>{x.baslik}</b></td><td>{{ video: "Video", metin: "Yazılı", baglanti: "Bağlantı" }[x.tur]}</td><td>{tarih(x.olusturma)}</td>
                <td>{x.ogretmen_id === k.kullaniciId && <KayitDugmesi eylem={konuSil.bind(null, x.id)} etiket="Sil" tur="ikincil" onay="Emin misin?" />}</td></tr>
            ))}
          </tbody>
        </table>
      </Kart>
    </PanelKabugu>
  );
}
