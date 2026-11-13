import { Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { panelRpc } from "@/lib/panel";
import { paneleErisebilir, yetkilerim } from "@/lib/yetki";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface Sinif { id: string; ad: string; sinav_turu: string; seviye: number; sube: string; ogrenci: number; aktif7: number; soru7: number; ogretmenim: boolean }

export default async function Ogretmen() {
  const y = await yetkilerim();
  const ogretmen = paneleErisebilir(y, "ogretmen");
  if (!ogretmen && !paneleErisebilir(y, "dershane")) redirect("/?yetkisiz=1");
  const siniflar = await panelRpc<Sinif[]>("panel_siniflarim");
  const toplam = siniflar.reduce((a, s) => a + s.ogrenci, 0);
  const aktif = siniflar.reduce((a, s) => a + s.aktif7, 0);
  const soru = siniflar.reduce((a, s) => a + s.soru7, 0);
  return (
    <PanelKabugu baslik="Sınıflarım" panel={ogretmen ? "ogretmen" : "dershane"} aktif="/ogretmen">
      <Metrik deger={siniflar.length} etiket="Sınıf" renk="#7c5cfa" ikon="◧" />
      <Metrik deger={toplam} etiket="Öğrenci" renk="#3fa9f5" ikon="☺" />
      <Metrik deger={`%${toplam ? Math.round((aktif / toplam) * 100) : 0}`} etiket="Son 7 gün aktif" renk="#12b76a" ikon="↗" />
      <Metrik deger={soru.toLocaleString("tr-TR")} etiket="Bu hafta çözülen soru" renk="#ff6a3d" ikon="✓" />
      {siniflar.length === 0 && <Kart genis aciklama="Atandığın sınıf yok. Kurucu panelinden sınıf ataması yapılır." />}
      {siniflar.map((s) => (
        <a key={s.id} href={`/ogretmen/sinif/${s.id}`} className="kart tik">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{s.ad}</h3>
            <span className="rozet vurgu">{s.sinav_turu}</span>
          </div>
          <p>{s.sube} · {s.ogrenci} öğrenci{s.ogretmenim ? "" : " · gözlem"}</p>
          <div style={{ display: "flex", gap: 18, marginTop: 14 }}>
            <div><strong style={{ fontSize: 22 }}>{s.aktif7}/{s.ogrenci}</strong><div className="soluk kucuk">7 gün aktif</div></div>
            <div><strong style={{ fontSize: 22 }}>{s.soru7}</strong><div className="soluk kucuk">soru</div></div>
          </div>
          <div className="cubuk" style={{ marginTop: 12 }}><i style={{ width: `${s.ogrenci ? Math.round((s.aktif7 / s.ogrenci) * 100) : 0}%` }} /></div>
        </a>
      ))}
    </PanelKabugu>
  );
}
