import { CubukGrafik, Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";
import { YazdirDugmesi } from "./YazdirDugmesi";

export const dynamic = "force-dynamic";

/** 30 günlük pilot raporu: satış görüşmesinde kullanılır (tarayıcıdan PDF). */
export default async function PilotRaporu({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.satis");
  const { id } = await params;
  const s = servis();
  const bas = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: d }, { data: cevaplar }, { count: ogrenci }, { data: beceri }] = await Promise.all([
    s.from("dershane").select("ad, lisans_durumu, lisans_baslangic").eq("id", id).single(),
    s.from("cevap").select("kullanici_id, dogru_mu, sure_ms, olusturma").eq("dershane_id", id).gte("olusturma", bas).limit(50000),
    s.from("kullanici").select("id", { count: "exact", head: true }).eq("dershane_id", id).eq("tur", "ogrenci"),
    s.from("beceri").select("ustalik").eq("dershane_id", id).neq("ustalik", "kesfedilmedi"),
  ]);
  const c = cevaplar ?? [];
  const aktif = new Set(c.map((x) => x.kullanici_id)).size;
  const gunler = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86400000).toISOString().slice(0, 10));
  const gunluk = gunler.map((g) => c.filter((x) => (x.olusturma as string).slice(0, 10) === g).length);
  const ilk = c.filter((x) => Date.parse(x.olusturma as string) < Date.now() - 23 * 86400000);
  const son = c.filter((x) => Date.parse(x.olusturma as string) > Date.now() - 7 * 86400000);
  const oran = (l: typeof c) => (l.length ? Math.round((l.filter((x) => x.dogru_mu).length / l.length) * 100) : 0);
  const dk = Math.round(c.reduce((a, x) => a + Math.min(Number(x.sure_ms), 300000), 0) / 60000);
  const usta = (beceri ?? []).length;
  return (
    <PanelKabugu baslik={`Pilot raporu · ${d?.ad ?? ""}`} panel="merkez" aktif="/merkez/dershaneler" yol={`Son 30 gün · ${tarih(gunler[0])} – ${tarih(gunler[29])}`} sag={<YazdirDugmesi />}>
      <Metrik deger={`${aktif}/${ogrenci ?? 0}`} etiket="Aktif öğrenci" renk="#7c5cfa" ikon="☺" />
      <Metrik deger={c.length.toLocaleString("tr-TR")} etiket={`Çözülen soru · öğrenci başı ${aktif ? Math.round(c.length / aktif) : 0}`} renk="#3fa9f5" ikon="✓" />
      <Metrik deger={`${dk.toLocaleString("tr-TR")} dk`} etiket="Toplam çalışma süresi" renk="#12b76a" ikon="◷" />
      <Metrik deger={`%${oran(ilk)} → %${oran(son)}`} etiket="Doğruluk: ilk hafta → son hafta" renk="#ff6a3d" ikon="↗" />
      <Metrik deger={usta.toLocaleString("tr-TR")} etiket="Ustalık kazanılan kazanım (öğrenci × kazanım)" renk="#f5a400" ikon="★" />
      <Kart genis baslik="Günlük çözülen soru">
        <CubukGrafik veri={gunluk} etiketler={gunler.map((g) => tarih(g))} />
      </Kart>
    </PanelKabugu>
  );
}
