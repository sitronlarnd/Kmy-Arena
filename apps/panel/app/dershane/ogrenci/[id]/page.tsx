import { hesapAc2, hesapKapat, sifreYenile, sinifDegistir, veliKodu } from "@/app/dershane/kayit/eylemler";
import { KayitDugmesi, KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { yetkiIste } from "@/lib/hesap";
import { onceKac, tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { paneliKoru } from "@/lib/yetki";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OgrenciYonet({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("dershane");
  const { id } = await params;
  const s = servis();
  const { data: o } = await s.from("kullanici").select("id, ad, soyad, takma_ad, dershane_id, sube_id, dogum_yili, veli_onayi, son_giris, silinme_talebi, olusturma, tur").eq("id", id).maybeSingle();
  if (!o || o.tur !== "ogrenci") notFound();
  const k = await yetkiIste("ogrenci.kimlik_oku", o.sube_id as string | null);
  if (k.dershaneId !== o.dershane_id) notFound();
  const [{ data: uyelik }, { data: siniflar }, { data: veliler }, { data: u }] = await Promise.all([
    s.from("sinif_uyelik").select("sinif:sinif_id(id, ad)").eq("kullanici_id", id).eq("rol", "ogrenci"),
    s.from("sinif").select("id, ad, sube:sube_id(ad)").eq("dershane_id", k.dershaneId).eq("arsiv", false).order("ad"),
    s.from("veli_bag").select("veli:veli_id(ad, soyad), onay_tarihi").eq("ogrenci_id", id),
    s.auth.admin.getUserById(id),
  ]);
  const giris = (u.user?.email ?? "").replace(/@ogrenci\.kmyarena\.app$/, "");
  const mevcut = ((uyelik ?? []) as unknown as { sinif: { id: string; ad: string } | null }[])[0]?.sinif;
  return (
    <PanelKabugu baslik={`${o.ad as string} ${o.soyad as string}`} panel="dershane" aktif="/dershane/ogrenciler" yol={<><a href="/dershane/ogrenciler">Öğrenciler</a> › Yönet · <a href={`/ogretmen/ogrenci/${id}`}>360° görünüm</a></>}>
      <Kart baslik="Hesap">
        <table className="tablo"><tbody>
          <tr><td className="soluk">Kullanıcı adı</td><td><code>{giris}</code></td></tr>
          <tr><td className="soluk">Takma ad</td><td>{(o.takma_ad as string) ?? "—"}</td></tr>
          <tr><td className="soluk">Sınıf</td><td>{mevcut?.ad ?? "—"}</td></tr>
          <tr><td className="soluk">Doğum yılı</td><td>{(o.dogum_yili as number) ?? "—"}</td></tr>
          <tr><td className="soluk">Veli onayı</td><td>{o.veli_onayi ? <span className="rozet dogru">Var</span> : <span className="rozet altin">Bekliyor</span>}</td></tr>
          <tr><td className="soluk">Kayıt / son giriş</td><td>{tarih(o.olusturma as string)} · {onceKac(o.son_giris as string | null)}</td></tr>
          {o.silinme_talebi ? <tr><td className="soluk">Durum</td><td><span className="rozet yanlis">Kapalı ({tarih(o.silinme_talebi as string)})</span></td></tr> : null}
        </tbody></table>
      </Kart>
      <Kart baslik="Sınıf değiştir">
        <KayitFormu eylem={sinifDegistir} dugme="Taşı">
          <input type="hidden" name="ogrenci" value={id} />
          <select name="sinif" className="alan" defaultValue={mevcut?.id}>{((siniflar ?? []) as unknown as { id: string; ad: string; sube: { ad: string } | null }[]).map((c) => <option key={c.id} value={c.id}>{c.ad} · {c.sube?.ad}</option>)}</select>
        </KayitFormu>
      </Kart>
      <Kart baslik="Veli">
        {(veliler ?? []).length === 0 ? <p>Bağlı veli yok.</p> : ((veliler ?? []) as unknown as { veli: { ad: string; soyad: string } | null }[]).map((v, i) => <p key={i}>{v.veli?.ad} {v.veli?.soyad}</p>)}
        <div style={{ marginTop: 10 }}><KayitDugmesi eylem={veliKodu.bind(null, id)} etiket="Veli davet kodu üret" /></div>
      </Kart>
      <Kart baslik="Giriş ve hesap işlemleri">
        <div style={{ display: "grid", gap: 10 }}>
          <KayitDugmesi eylem={sifreYenile.bind(null, id)} etiket="Geçici şifre üret (şifremi unuttum)" tur="ikincil" />
          {o.silinme_talebi
            ? <KayitDugmesi eylem={hesapAc2.bind(null, id)} etiket="Hesabı yeniden aç" />
            : <KayitDugmesi eylem={hesapKapat.bind(null, id)} etiket="Hesabı kapat (kaydı silindi)" tur="tehlike" onay="Emin misin? 30 gün sonra kalıcı silinir" />}
        </div>
      </Kart>
    </PanelKabugu>
  );
}
