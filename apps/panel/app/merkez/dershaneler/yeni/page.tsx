import { dershaneOlustur } from "@/app/merkez/eylemler";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function YeniDershane({ searchParams }: { searchParams: Promise<{ teklif?: string }> }) {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.dershane_yonet");
  const { teklif } = await searchParams;
  const s = servis();
  const [{ data: paketler }, { data: t }] = await Promise.all([
    s.from("paket").select("id, ad, kod").order("ad"),
    teklif ? s.from("teklif").select("dershane_adi, sehir, yetkili, eposta, ogrenci_sayisi, pilot_talebi").eq("id", teklif).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const [yAd = "", ...ySoyad] = ((t?.yetkili as string) ?? "").split(" ");
  const bugun = new Date().toISOString().slice(0, 10);
  const otuz = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return (
    <PanelKabugu baslik="Yeni dershane" panel="merkez" aktif="/merkez/dershaneler" yol={<><a href="/merkez/dershaneler">Dershaneler</a> › Yeni</>}>
      <Kart genis>
        <KayitFormu eylem={dershaneOlustur} dugme="Dershaneyi oluştur">
          <input type="hidden" name="teklif" value={teklif ?? ""} />
          <div className="izgara-form">
            <h3 className="tam">1 · Dershane</h3>
            <label>Dershane adı<input name="ad" required defaultValue={(t?.dershane_adi as string) ?? ""} className="alan" /></label>
            <label>Şehir<input name="sehir" defaultValue={(t?.sehir as string) ?? ""} className="alan" /></label>
            <label>İlk şube adı<input name="sube" placeholder="Merkez Şube" className="alan" /></label>
            <label>Uygulamada görünen ad<input name="uygulama_ad" placeholder="ör. Zirve Arena" className="alan" /></label>
            <label>Ana renk<input name="renk" type="color" defaultValue="#6D5CFF" className="alan" /></label>
            <label>Sınav grubu
              <select name="sablon" className="alan"><option value="LGS">LGS</option><option value="YKS">YKS</option><option value="HER">LGS + YKS</option></select>
            </label>
            <label className="tam" style={{ display: "flex", gap: 8, alignItems: "center" }}><input type="checkbox" name="ornek_sinif" defaultChecked /> Örnek sınıfları oluştur (8-A / 12-SAY, 12-EA)</label>
            <h3 className="tam">2 · Lisans</h3>
            <label>Paket<select name="paket" className="alan">{(paketler ?? []).map((p) => <option key={p.id as string} value={p.id as string}>{p.ad as string}</option>)}</select></label>
            <label>Öğrenci limiti<input name="limit" type="number" min={1} defaultValue={Math.max(50, Number(t?.ogrenci_sayisi ?? 0))} className="alan" /></label>
            <label>Durum<select name="durum" className="alan" defaultValue={t?.pilot_talebi === false ? "aktif" : "pilot"}><option value="pilot">Pilot (deneme)</option><option value="aktif">Aktif</option></select></label>
            <label>Başlangıç<input name="baslangic" type="date" defaultValue={bugun} className="alan" /></label>
            <label>Bitiş<input name="bitis" type="date" defaultValue={otuz} className="alan" /></label>
            <h3 className="tam">3 · Kurucu hesabı</h3>
            <label>Ad<input name="kurucu_ad" required defaultValue={yAd} className="alan" /></label>
            <label>Soyad<input name="kurucu_soyad" required defaultValue={ySoyad.join(" ")} className="alan" /></label>
            <label>E-posta<input name="kurucu_eposta" type="email" required defaultValue={(t?.eposta as string) ?? ""} className="alan" /></label>
          </div>
        </KayitFormu>
      </Kart>
    </PanelKabugu>
  );
}
