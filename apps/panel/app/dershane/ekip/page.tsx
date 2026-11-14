import { VARSAYILAN_ROL_YETKILERI, YETKILER, type RolKodu, type YetkiKodu } from "@kmy/shared";
import { atamaKaldir, ogretmenAta, personelEkle, rolDegistir, yetkiAyarla } from "@/app/dershane/kayit/eylemler";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { onceKac } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { YetkiKutusu } from "./YetkiKutusu";

export const dynamic = "force-dynamic";

const ROLLER: Record<string, string> = { kurucu: "Kurucu", sube_muduru: "Şube müdürü", rehber_ogretmen: "Rehber öğretmen", ogretmen: "Öğretmen", sekreter: "Sekreter" };
const AYARLANABILIR: RolKodu[] = ["sube_muduru", "rehber_ogretmen", "ogretmen", "sekreter"];
const DERSHANE_YETKILERI = (Object.keys(YETKILER) as YetkiKodu[]).filter((y) => !y.startsWith("merkez.") && !y.startsWith("bayi.") && !["soru.coz", "duello.oyna", "klan.katil", "topluluk.yaz", "veli.rapor_oku"].includes(y));

export default async function Ekip() {
  await paneliKoru("dershane");
  const k = await yetkiIste("ogretmen.yonet").catch(() => yetkiIste("dershane.rol_ata"));
  const rolAta = await yetkiIste("dershane.rol_ata").then(() => true, () => false);
  const s = servis();
  const [{ data: personel }, { data: roller }, { data: subeler }, { data: siniflar }, { data: atamalar }, { data: dersler }, { data: ozel }] = await Promise.all([
    s.from("kullanici").select("id, ad, soyad, son_giris, sube_id").eq("dershane_id", k.dershaneId).eq("tur", "personel").is("silinme_talebi", null).order("ad"),
    s.from("kullanici_rol").select("kullanici_id, rol_kod, sube_id").eq("dershane_id", k.dershaneId),
    s.from("sube").select("id, ad").eq("dershane_id", k.dershaneId).order("ad"),
    s.from("sinif").select("id, ad, sinav_turu, sube:sube_id(ad)").eq("dershane_id", k.dershaneId).eq("arsiv", false).order("ad"),
    s.from("sinif_uyelik").select("kullanici_id, sinif_id, ders_ids").eq("dershane_id", k.dershaneId).eq("rol", "ogretmen"),
    s.from("ders").select("id, ad, sinav_turu").order("sira"),
    s.from("rol_yetki").select("rol_kod, yetki_kod").eq("dershane_id", k.dershaneId),
  ]);
  const subeAd = Object.fromEntries((subeler ?? []).map((x) => [x.id as string, x.ad as string]));
  const sinifAd = Object.fromEntries(((siniflar ?? []) as unknown as { id: string; ad: string; sube: { ad: string } | null }[]).map((x) => [x.id, `${x.ad} · ${x.sube?.ad ?? ""}`]));
  const dersAd = Object.fromEntries((dersler ?? []).map((x) => [x.id as string, `${x.ad as string}`]));
  const matris = (rol: RolKodu, y: YetkiKodu) => {
    const o = (ozel ?? []).filter((x) => x.rol_kod === rol);
    return o.length ? o.some((x) => x.yetki_kod === y) : VARSAYILAN_ROL_YETKILERI[rol].includes(y);
  };
  const ogretmenler = (personel ?? []).filter((p) => (roller ?? []).some((r) => r.kullanici_id === p.id && r.rol_kod === "ogretmen"));
  return (
    <PanelKabugu baslik="Ekip, roller ve öğretmen atamaları" panel="dershane" aktif="/dershane/ekip">
      <Kart genis baslik="Personel ekle" aciklama="Hesap geçici şifreyle açılır; e-posta servisi tanımlıysa giriş bilgileri kişiye e-postayla da gider. İlk girişte şifre değiştirilir.">
        <KayitFormu eylem={personelEkle} dugme="Hesap aç">
          <input name="ad" placeholder="Ad" required className="alan" />
          <input name="soyad" placeholder="Soyad" required className="alan" />
          <input name="eposta" type="email" placeholder="E-posta" required className="alan" />
          <select name="rol" className="alan">{Object.entries(ROLLER).filter(([r]) => rolAta || r === "ogretmen").map(([r, a]) => <option key={r} value={r}>{a}</option>)}</select>
          <select name="sube" className="alan"><option value="">Şube (müdür/sekreter için)</option>{(subeler ?? []).map((x) => <option key={x.id as string} value={x.id as string}>{x.ad as string}</option>)}</select>
        </KayitFormu>
      </Kart>
      <Kart genis baslik="Personel ve roller">
        <div className="kaydir">
          <table className="tablo">
            <thead><tr><th>Ad</th><th>Roller</th><th>Sınıf / ders atamaları</th><th>Son giriş</th></tr></thead>
            <tbody>
              {(personel ?? []).map((p) => {
                const r = (roller ?? []).filter((x) => x.kullanici_id === p.id);
                const a = (atamalar ?? []).filter((x) => x.kullanici_id === p.id);
                return (
                  <tr key={p.id as string}>
                    <td><b>{p.ad as string} {p.soyad as string}</b></td>
                    <td>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        {r.map((x) => (
                          <span key={x.rol_kod as string} className="rozet">{ROLLER[x.rol_kod as string] ?? x.rol_kod as string}{x.sube_id ? ` · ${subeAd[x.sube_id as string] ?? ""}` : ""}
                            {rolAta && <KayitDugmesi eylem={rolDegistir.bind(null, p.id as string, x.rol_kod as string, false, null)} etiket="×" tur="ikincil" onay="Kaldır?" />}
                          </span>
                        ))}
                        {rolAta && (
                          <details className="kucuk"><summary>+ rol</summary>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                              {Object.entries(ROLLER).filter(([kod]) => !r.some((x) => x.rol_kod === kod) && kod !== "sube_muduru" && kod !== "sekreter").map(([kod, ad]) => (
                                <KayitDugmesi key={kod} eylem={rolDegistir.bind(null, p.id as string, kod, true, null)} etiket={ad} tur="ikincil" />
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </td>
                    <td>
                      {a.map((x) => (
                        <div key={x.sinif_id as string} className="kucuk" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span className="rozet">{sinifAd[x.sinif_id as string] ?? "?"}</span>
                          <span className="soluk">{(x.ders_ids as string[] | null)?.map((d) => dersAd[d]).join(", ") ?? "tüm dersler"}</span>
                          <KayitDugmesi eylem={atamaKaldir.bind(null, p.id as string, x.sinif_id as string)} etiket="×" tur="ikincil" />
                        </div>
                      ))}
                      {r.some((x) => x.rol_kod === "ogretmen") ? null : a.length === 0 ? <span className="soluk">—</span> : null}
                    </td>
                    <td className="soluk">{onceKac(p.son_giris as string | null)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Kart>
      <Kart genis baslik="Öğretmeni sınıfa ata" aciklama="Öğretmen yalnızca atandığı sınıfların öğrenci verisini görür. Ders seçmezseniz tüm dersler.">
        <KayitFormu eylem={ogretmenAta} dugme="Ata">
          <select name="ogretmen" required className="alan">{ogretmenler.map((o) => <option key={o.id as string} value={o.id as string}>{o.ad as string} {o.soyad as string}</option>)}</select>
          <select name="sinif" required className="alan">{Object.entries(sinifAd).map(([id, ad]) => <option key={id} value={id}>{ad}</option>)}</select>
          <select name="ders" multiple className="alan" style={{ minHeight: 90 }}>{(dersler ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.ad as string} ({d.sinav_turu as string})</option>)}</select>
        </KayitFormu>
      </Kart>
      {rolAta && (
        <Kart genis baslik="Rol yetkileri (ince ayar)" aciklama="Varsayılan yetkiler işaretli gelir. Değiştirdiğiniz rol için dershanenize özel yetki seti oluşur.">
          <div className="kaydir">
            <table className="tablo matris">
              <thead><tr><th>Yetki</th>{AYARLANABILIR.map((r) => <th key={r}>{ROLLER[r]}</th>)}</tr></thead>
              <tbody>
                {DERSHANE_YETKILERI.map((y) => (
                  <tr key={y}>
                    <td>{YETKILER[y]}</td>
                    {AYARLANABILIR.map((r) => <td key={r}><YetkiKutusu acik={matris(r, y)} eylem={yetkiAyarla.bind(null, r, y)} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Kart>
      )}
    </PanelKabugu>
  );
}
