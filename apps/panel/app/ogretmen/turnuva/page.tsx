import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { dersListesi } from "@/lib/mufredat";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { turnuvaIptal, turnuvaOlustur } from "./eylemler";

export const dynamic = "force-dynamic";

interface Mac { tur: number; sira: number; a: string | null; b: string | null; kazanan: string | null; durum: string }

export default async function Turnuva() {
  await paneliKoru("ogretmen");
  const k = await yetkiIste("odev.yonet");
  const s = servis();
  const [{ data: siniflar }, dersler, { data: turnuvalar }] = await Promise.all([
    s.from("sinif_uyelik").select("sinif:sinif_id(id, ad)").eq("kullanici_id", k.kullaniciId).eq("rol", "ogretmen"),
    dersListesi(),
    s.from("turnuva").select("id, ad, durum, boyut, tur, odul, olusturma, kazanan_id, sinif:sinif_id(ad), ders:ders_id(ad)").eq("dershane_id", k.dershaneId).order("olusturma", { ascending: false }).limit(10),
  ]);
  const idler = (turnuvalar ?? []).map((t) => t.id as string);
  const [{ data: maclar }, { data: adlar }] = await Promise.all([
    idler.length ? s.from("turnuva_mac").select("turnuva_id, tur, sira, a, b, kazanan, durum").in("turnuva_id", idler) : Promise.resolve({ data: [] }),
    s.from("kullanici").select("id, takma_ad, ad").eq("dershane_id", k.dershaneId).eq("tur", "ogrenci"),
  ]);
  const ad = new Map((adlar ?? []).map((x) => [x.id as string, (x.takma_ad as string) ?? (x.ad as string)]));
  const sl = ((siniflar ?? []) as unknown as { sinif: { id: string; ad: string } | null }[]).flatMap((x) => (x.sinif ? [x.sinif] : []));
  return (
    <PanelKabugu baslik="Sınıf turnuvası" panel="ogretmen" aktif="/ogretmen/turnuva">
      <Kart genis baslik="Yeni turnuva" aciklama="Sınıfın en aktif öğrencileri seviyeye göre eşleşir (1. - son, 2. - sondan bir önceki…). Her maç 5 soruluk düellodur ve 24 saat içinde oynanır; tur bitince bir sonraki tur otomatik başlar. Şampiyon +150 XP ve +100 Altın kazanır.">
        <KayitFormu eylem={turnuvaOlustur} dugme="Turnuvayı başlat">
          <input name="ad" placeholder="Turnuva adı" className="alan" required />
          <select name="sinif" required className="alan">{sl.map((c) => <option key={c.id} value={c.id}>{c.ad}</option>)}</select>
          <select name="ders" required className="alan">{dersler.map((d) => <option key={d.id} value={d.id}>{d.sinav_turu} · {d.ad}</option>)}</select>
          <select name="boyut" className="alan" defaultValue="8"><option value="4">4 kişi</option><option value="8">8 kişi</option><option value="16">16 kişi</option><option value="32">32 kişi</option></select>
          <input name="odul" placeholder="Ödül (ör. kitap seti)" className="alan" />
        </KayitFormu>
      </Kart>
      {((turnuvalar ?? []) as unknown as { id: string; ad: string; durum: string; boyut: number; tur: number; odul: string | null; olusturma: string; kazanan_id: string | null; sinif: { ad: string } | null; ders: { ad: string } | null }[]).map((t) => {
        const l = ((maclar ?? []) as unknown as (Mac & { turnuva_id: string })[]).filter((m) => m.turnuva_id === t.id);
        const turlar = [...new Set(l.map((m) => m.tur))].sort((a, b) => a - b);
        return (
          <Kart key={t.id} genis baslik={t.ad} aciklama={`${t.sinif?.ad ?? ""} · ${t.ders?.ad ?? ""} · ${tarih(t.olusturma)}${t.odul ? ` · Ödül: ${t.odul}` : ""}`}>
            <div className="form" style={{ margin: "8px 0" }}>
              <span className={`rozet ${t.durum === "bitti" ? "dogru" : t.durum === "iptal" ? "yanlis" : "vurgu"}`}>{t.durum === "bitti" ? `Şampiyon: ${ad.get(t.kazanan_id ?? "") ?? "?"}` : t.durum === "iptal" ? "İptal" : `${t.tur}. tur sürüyor`}</span>
              {t.durum === "surdu" && <KayitDugmesi eylem={turnuvaIptal.bind(null, t.id)} etiket="İptal et" tur="ikincil" onay="Emin misin?" />}
            </div>
            <div className="agac">
              {turlar.map((tr) => (
                <div key={tr} className="agac-tur">
                  {l.filter((m) => m.tur === tr).sort((a, b) => a.sira - b.sira).map((m) => (
                    <div key={m.sira} className="agac-mac">
                      {[m.a, m.b].map((o, i) => (
                        <div key={i} className={m.kazanan && m.kazanan === o ? "kazandi" : ""}><span>{o ? ad.get(o) ?? "?" : "bay"}</span>{m.durum === "oynaniyor" && i === 0 ? <span className="soluk">oynanıyor</span> : null}</div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Kart>
        );
      })}
    </PanelKabugu>
  );
}
