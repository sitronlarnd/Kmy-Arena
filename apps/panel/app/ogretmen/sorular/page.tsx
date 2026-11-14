import "katex/dist/katex.min.css";
import { KazanimSec } from "@/bilesenler/KazanimSec";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { mdHtml } from "@/lib/md";
import { kazanimListesi } from "@/lib/mufredat";
import { servis } from "@/lib/servis";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";
import { Arsiv, type ArsivSatiri } from "./Arsiv";
import { aiUret } from "./eylemler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function Sorular() {
  await paneliKoru("ogretmen");
  const k = await yetkiIste("soru.yukle");
  const s = await sunucuIstemcisi();
  const [{ data }, kazanimlar, { data: siniflar }] = await Promise.all([
    s.from("soru").select("id, govde_md, siklar, dogru, zorluk, durum, paylasim, ogretmen_id, uretici_model, cevap_sayisi, dogru_sayisi, ogretmen_cozum, kazanim:kazanim_id(kod, aciklama)")
      .eq("kaynak", "ogretmen").neq("durum", "emekli").order("olusturma", { ascending: false }).limit(300),
    kazanimListesi(),
    servis().from("sinif_uyelik").select("sinif:sinif_id(id, ad)").eq("kullanici_id", k.kullaniciId).eq("rol", "ogretmen"),
  ]);
  type Ham = { id: string; govde_md: string; siklar: Record<string, string>; dogru: string; zorluk: number; durum: string; paylasim: string; ogretmen_id: string; uretici_model: string | null; cevap_sayisi: number; dogru_sayisi: number; ogretmen_cozum: { tur: string } | null; kazanim: { kod: string; aciklama: string } | null };
  const satirlar: ArsivSatiri[] = ((data ?? []) as unknown as Ham[]).map((x) => ({
    id: x.id, html: mdHtml(x.govde_md), siklar: Object.entries(x.siklar).map(([h, v]) => ({ h, html: mdHtml(v) })), dogru: x.dogru, zorluk: Number(x.zorluk),
    durum: x.durum, paylasim: x.paylasim, benim: x.ogretmen_id === k.kullaniciId, ai: Boolean(x.uretici_model), kazanim: x.kazanim?.kod ?? "",
    cevap: x.cevap_sayisi, basari: x.cevap_sayisi ? Math.round((x.dogru_sayisi / x.cevap_sayisi) * 100) : null, cozum: x.ogretmen_cozum?.tur ?? null,
  }));
  const sl = ((siniflar ?? []) as unknown as { sinif: { id: string; ad: string } | null }[]).flatMap((x) => (x.sinif ? [x.sinif] : []));
  const bekleyen = satirlar.filter((x) => x.durum === "uretildi").length;
  return (
    <PanelKabugu baslik="Soru arşivim" panel="ogretmen" aktif="/ogretmen/sorular" sag={<a className="dugme" href="/ogretmen/sorular/yeni">+ Soru ekle</a>}
      yol="Arşiv soruları öğrencinin günlük akışına girmez; yalnız ödev, sınıf turnuvası ve canlı yarışmada kullanılır.">
      <Kart genis baslik="AI ile soru ürettir" aciklama="Kazanım ve zorluk seçin; AI üretir, ikinci bir model doğrular. Kontrolü geçen sorular onayınıza düşer (1-2 dk sürebilir).">
        <KayitFormu eylem={aiUret} dugme="Üret">
          <KazanimSec liste={kazanimlar} />
          <label className="kucuk soluk">Zorluk <input name="zorluk" type="number" min={1} max={10} defaultValue={5} className="alan" style={{ width: 70 }} /></label>
          <label className="kucuk soluk">Adet <input name="adet" type="number" min={1} max={5} defaultValue={3} className="alan" style={{ width: 70 }} /></label>
        </KayitFormu>
      </Kart>
      <Kart genis baslik={`Sorular (${satirlar.length})`} aciklama={bekleyen ? `${bekleyen} AI sorusu onayınızı bekliyor.` : "Soruları seçip ödev olarak verebilir ya da canlı yarışma başlatabilirsiniz."}>
        <Arsiv satirlar={satirlar} siniflar={sl} />
      </Kart>
    </PanelKabugu>
  );
}
