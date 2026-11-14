import { davetOlustur, davetPasif, ogrenciEkle, topluYukle } from "@/app/dershane/kayit/eylemler";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROL: Record<string, string> = { ogrenci: "Öğrenci", veli: "Veli", ogretmen: "Öğretmen", rehber_ogretmen: "Rehber", sube_muduru: "Şube müdürü", sekreter: "Sekreter", kurucu: "Kurucu" };

export default async function Kayit() {
  await paneliKoru("dershane");
  const k = await yetkiIste("ogrenci.ekle");
  const s = servis();
  const [{ data: siniflar }, { data: kodlar }, { data: d }, { count: ogrenci }] = await Promise.all([
    s.from("sinif").select("id, ad, sube_id, sube:sube_id(ad)").eq("dershane_id", k.dershaneId).eq("arsiv", false).order("ad"),
    s.from("davet_kodu").select("kod, rol_kod, sinif:sinif_id(ad), sube:sube_id(ad), ogrenci:ogrenci_id(ad, soyad), max_kullanim, kullanim, son_gecerlilik, aktif")
      .eq("dershane_id", k.dershaneId).eq("aktif", true).gt("son_gecerlilik", new Date().toISOString()).order("olusturma", { ascending: false }).limit(100),
    s.from("dershane").select("ogrenci_limiti").eq("id", k.dershaneId).single(),
    s.from("kullanici").select("id", { count: "exact", head: true }).eq("dershane_id", k.dershaneId).eq("tur", "ogrenci").is("silinme_talebi", null),
  ]);
  const sl = ((siniflar ?? []) as unknown as { id: string; ad: string; sube_id: string; sube: { ad: string } | null }[]).filter((c) => k.tum || k.subeler.includes(c.sube_id));
  const secenekler = sl.map((c) => <option key={c.id} value={c.id}>{c.ad} · {c.sube?.ad}</option>);
  type Kod = { kod: string; rol_kod: string; sinif: { ad: string } | null; sube: { ad: string } | null; ogrenci: { ad: string; soyad: string } | null; max_kullanim: number; kullanim: number; son_gecerlilik: string };
  return (
    <PanelKabugu baslik="Öğrenci kaydı ve davet kodları" panel="dershane" aktif="/dershane/kayit" yol={`Lisans: ${ogrenci ?? 0} / ${(d?.ogrenci_limiti as number) ?? "?"} öğrenci`}>
      <Kart genis baslik="Excel ile toplu öğrenci yükleme" aciklama="Sütunlar: Ad, Soyad, Sınıf (zorunlu); Şube, Doğum yılı, E-posta (isteğe bağlı). E-postası olmayan öğrenciye kullanıcı adı üretilir. Sonuçta yazdırılabilir giriş kartları çıkar.">
        <p className="kucuk" style={{ margin: "6px 0 12px" }}><a href="/dershane/kayit/sablon">Örnek Excel şablonunu indir</a></p>
        <KayitFormu eylem={topluYukle} dugme="Yükle ve hesapları aç" dosya>
          <input type="file" name="dosya" accept=".xlsx,.csv" required className="alan" />
        </KayitFormu>
      </Kart>
      <Kart baslik="Tek öğrenci ekle">
        <KayitFormu eylem={ogrenciEkle} dugme="Hesap aç">
          <input name="ad" placeholder="Ad" required className="alan" />
          <input name="soyad" placeholder="Soyad" required className="alan" />
          <select name="sinif" required className="alan">{secenekler}</select>
          <input name="dogum" placeholder="Doğum yılı" inputMode="numeric" className="alan" style={{ width: 120 }} />
          <input name="eposta" type="email" placeholder="E-posta (isteğe bağlı)" className="alan" />
        </KayitFormu>
      </Kart>
      <Kart baslik="Davet kodu üret" aciklama="Kodu alan kişi uygulamada kendi hesabını açar. Öğrenci kodları çok kullanımlık olabilir; veli kodlarını Veliler sayfasından öğrenciye özel üretin.">
        <KayitFormu eylem={davetOlustur} dugme="Kod üret">
          <select name="rol" className="alan">{["ogrenci", "ogretmen", "rehber_ogretmen", "sube_muduru", "sekreter"].map((r) => <option key={r} value={r}>{ROL[r]}</option>)}</select>
          <select name="sinif" className="alan"><option value="">Sınıf (öğrenci/öğretmen)</option>{secenekler}</select>
          <input name="max" type="number" min={1} max={1000} defaultValue={40} className="alan" style={{ width: 100 }} title="Kullanım sayısı" />
          <input name="gun" type="number" min={1} max={365} defaultValue={30} className="alan" style={{ width: 90 }} title="Geçerlilik (gün)" />
        </KayitFormu>
      </Kart>
      <Kart genis baslik="Aktif davet kodları">
        <div className="kaydir">
          <table className="tablo">
            <thead><tr><th>Kod</th><th>Rol</th><th>Hedef</th><th>Kullanım</th><th>Son gün</th><th /></tr></thead>
            <tbody>
              {(kodlar ?? []).length === 0 && <tr><td colSpan={6} className="bos">Aktif kod yok.</td></tr>}
              {((kodlar ?? []) as unknown as Kod[]).map((x) => (
                <tr key={x.kod}>
                  <td><code style={{ fontSize: 15, fontWeight: 800 }}>{x.kod}</code></td>
                  <td>{ROL[x.rol_kod] ?? x.rol_kod}</td>
                  <td>{x.ogrenci ? `${x.ogrenci.ad} ${x.ogrenci.soyad} velisi` : x.sinif?.ad ?? x.sube?.ad ?? "Tüm dershane"}</td>
                  <td>{x.kullanim} / {x.max_kullanim}</td>
                  <td>{tarih(x.son_gecerlilik)}</td>
                  <td><KayitDugmesi eylem={davetPasif.bind(null, x.kod)} etiket="Kapat" tur="ikincil" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
