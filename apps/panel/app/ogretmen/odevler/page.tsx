import { Cubuk, Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { OdevFormu, type DersVerisi } from "@/bilesenler/OdevFormu";
import { panelRpc, tarih } from "@/lib/panel";
import { sunucuIstemcisi } from "@/lib/supabase";
import { paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

interface Odev { id: string; baslik: string; son_tarih: string; olusturma: string; soru_sayisi: number; zorluk_modu: string; kazanimlar: string[]; atanan: number; biten: number; dogruluk: number | null }

export default async function Odevler({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  await paneliKoru("ogretmen");
  const { yeni } = await searchParams;
  const s = await sunucuIstemcisi();
  const [odevler, siniflar, dersHam] = await Promise.all([
    panelRpc<Odev[]>("panel_odevler"),
    panelRpc<Array<{ id: string; ad: string; sinav_turu: string; ogretmenim: boolean }>>("panel_siniflarim"),
    s.from("ders").select("id, ad, sinav_turu, sira, unite(ad, sira, kazanim(id, kod, aciklama, sira))").order("sira"),
  ]);
  const turler = new Set(siniflar.map((x) => x.sinav_turu === "LGS" ? "LGS" : "YKS"));
  const dersler: DersVerisi[] = ((dersHam.data ?? []) as Array<{ id: string; ad: string; sinav_turu: string; unite: Array<{ ad: string; sira: number; kazanim: Array<{ id: string; kod: string; aciklama: string; sira: number }> }> }>)
    .filter((d) => turler.has(d.sinav_turu === "LGS" ? "LGS" : "YKS"))
    .map((d) => ({
      id: d.id, ad: d.ad, sinav_turu: d.sinav_turu,
      kazanimlar: [...d.unite].sort((a, b) => a.sira - b.sira).flatMap((u) => [...u.kazanim].sort((a, b) => a.sira - b.sira).map((k) => ({ id: k.id, kod: k.kod, aciklama: k.aciklama, unite: u.ad }))),
    }));
  return (
    <PanelKabugu baslik="Ödevler" panel="ogretmen" aktif="/ogretmen/odevler">
      {yeni && <Kart genis vurgu baslik="Ödev gönderildi" aciklama="Öğrenciler Arena ekranında ödevi görüyor. İlerleme burada güncellenir." />}
      <Kart genis baslik="Yeni ödev" aciklama="Uyarlamalı modda her öğrenci kendi seviyesinde soru alır; ödevin tamamlanması soru sayısına göre izlenir.">
        <div style={{ marginTop: 14 }}><OdevFormu siniflar={siniflar.filter((x) => x.ogretmenim)} dersler={dersler} /></div>
      </Kart>
      {odevler.map((o) => (
        <Kart key={o.id} baslik={o.baslik}>
          <p>{o.kazanimlar?.join(", ")} · {o.soru_sayisi} soru · {o.zorluk_modu === "sabit" ? "sabit zorluk" : "uyarlamalı"}</p>
          <div style={{ display: "flex", justifyContent: "space-between", margin: "12px 0 6px" }}>
            <strong>{o.biten}/{o.atanan} bitirdi</strong>
            <span className={`rozet ${Date.parse(o.son_tarih) < Date.now() ? "yanlis" : "altin"}`}>Son: {tarih(o.son_tarih, true)}</span>
          </div>
          <Cubuk oran={o.atanan ? o.biten / o.atanan : 0} />
          <p style={{ marginTop: 8 }}>Doğruluk: {o.dogruluk === null ? "—" : `%${o.dogruluk}`}</p>
        </Kart>
      ))}
    </PanelKabugu>
  );
}
