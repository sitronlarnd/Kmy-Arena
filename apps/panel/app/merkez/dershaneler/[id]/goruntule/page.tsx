import { notFound } from "next/navigation";
import { Kart, Metrik, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { onceKac, tarih } from "@/lib/panel";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

/** Destek amaçlı salt okunur dershane görünümü. Dershane panelinde bant çıkar; denetim kaydına yazılır (kişisel veriler maskeli). */
export default async function Goruntule({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("merkez");
  const k = await merkezYetkisi("merkez.destek");
  const { id } = await params;
  const s = servis();
  const { data: d } = await s.from("dershane").select("id, ad, sehir, lisans_durumu, lisans_bitis, ogrenci_limiti, ayarlar, paket:paket_id(ad)").eq("id", id).maybeSingle();
  if (!d) notFound();
  const { data: aktif } = await s.from("destek_goruntuleme").select("id").eq("dershane_id", id).eq("merkez_id", k).gt("bitis", new Date().toISOString()).maybeSingle();
  if (!aktif) {
    await s.from("destek_goruntuleme").insert({ dershane_id: id, merkez_id: k });
    await denetle(k, "destek.dershane_goruntule", id, {});
  }
  const hafta = new Date(Date.now() - 7 * 86400000).toISOString();
  const [{ data: subeler }, { data: siniflar }, { data: personel }, { count: ogr }, { count: aktifOgr }, { data: sikayet }, { data: talepler }] = await Promise.all([
    s.from("sube").select("id, ad").eq("dershane_id", id),
    s.from("sinif").select("id, ad, sinav_turu, seviye, arsiv, sube_id").eq("dershane_id", id).order("ad"),
    s.from("kullanici").select("id, ad, soyad, son_giris, roller:kullanici_rol(rol_kod)").eq("dershane_id", id).eq("tur", "personel"),
    s.from("kullanici").select("id", { count: "exact", head: true }).eq("dershane_id", id).eq("tur", "ogrenci").is("silinme_talebi", null),
    s.from("kullanici").select("id", { count: "exact", head: true }).eq("dershane_id", id).eq("tur", "ogrenci").gte("son_giris", hafta),
    s.from("sikayet").select("sebep, durum").eq("dershane_id", id).eq("durum", "acik"),
    s.from("destek_talep").select("id, konu, durum, olusturma").eq("dershane_id", id).order("olusturma", { ascending: false }).limit(5),
  ]);
  const maske = (ad: string, soyad: string) => `${ad} ${soyad.slice(0, 1)}.`;
  return (
    <PanelKabugu baslik={`${d.ad as string} · salt okunur`} panel="merkez" aktif="/merkez/dershaneler" yol={`Destek görünümü · ${d.sehir ?? ""} · paket ${(d.paket as unknown as { ad: string } | null)?.ad ?? "—"} · lisans ${d.lisans_durumu as string} (${tarih(d.lisans_bitis as string | null)})`}>
      <Metrik deger={`${ogr ?? 0} / ${d.ogrenci_limiti as number}`} etiket="Öğrenci / limit" renk="#7c5cfa" ikon="☺" />
      <Metrik deger={aktifOgr ?? 0} etiket="Son 7 gün giriş yapan" renk="#12b76a" ikon="✓" />
      <Metrik deger={(sikayet ?? []).length} etiket="Açık şikâyet" renk="#e5354f" ikon="!" />
      <Kart baslik="Şube ve sınıflar">
        {(subeler ?? []).map((sb) => (
          <p key={sb.id as string}><b>{sb.ad as string}</b>: {(siniflar ?? []).filter((c) => c.sube_id === sb.id).map((c) => `${c.ad as string}${c.arsiv ? " (arşiv)" : ""}`).join(", ") || "—"}</p>
        ))}
      </Kart>
      <Kart baslik="Personel (maskeli)">
        <table className="tablo"><tbody>{((personel ?? []) as unknown as { id: string; ad: string; soyad: string; son_giris: string | null; roller: { rol_kod: string }[] }[]).map((p) => (
          <tr key={p.id}><td>{maske(p.ad, p.soyad)}</td><td className="kucuk">{p.roller.map((r) => r.rol_kod).join(", ")}</td><td className="soluk">{onceKac(p.son_giris)}</td></tr>
        ))}</tbody></table>
      </Kart>
      <Kart baslik="Dershane ayarları"><pre className="kucuk" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(d.ayarlar, null, 2)}</pre></Kart>
      <Kart baslik="Destek talepleri">{(talepler ?? []).map((t) => <p key={t.id as string}><a href={`/merkez/destek/${t.id as string}`}>{t.konu as string}</a> · {t.durum as string}</p>)}</Kart>
    </PanelKabugu>
  );
}
