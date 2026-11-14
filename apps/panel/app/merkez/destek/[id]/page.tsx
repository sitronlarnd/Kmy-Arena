import { notFound } from "next/navigation";
import { destekYanit } from "@/app/merkez/merkez-eylemleri";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function DestekDetay({ params }: { params: Promise<{ id: string }> }) {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.destek");
  const { id } = await params;
  const s = servis();
  const [{ data: t }, { data: m }] = await Promise.all([
    s.from("destek_talep").select("id, konu, oncelik, durum, olusturma, dershane:dershane_id(id, ad), acan:acan_id(ad, soyad)").eq("id", id).maybeSingle(),
    s.from("destek_mesaj").select("id, metin, merkez, olusturma, yazan:yazan_id(ad, soyad)").eq("talep_id", id).order("olusturma"),
  ]);
  if (!t) notFound();
  const d = t.dershane as unknown as { id: string; ad: string } | null;
  return (
    <PanelKabugu baslik={t.konu as string} panel="merkez" aktif="/merkez/destek" yol={<><a href="/merkez/destek">Destek</a> › {d?.ad} · <a href={`/merkez/dershaneler/${d?.id}/goruntule`}>Dershaneyi görüntüle</a></>}>
      <Kart genis>
        <div style={{ display: "grid", gap: 10 }}>
          {((m ?? []) as unknown as { id: number; metin: string; merkez: boolean; olusturma: string; yazan: { ad: string; soyad: string } | null }[]).map((x) => (
            <div key={x.id} className="kart" style={{ background: x.merkez ? "var(--yuzey2)" : undefined, marginLeft: x.merkez ? 60 : 0 }}>
              <div className="kucuk soluk">{x.merkez ? "Merkez" : "Dershane"} · {x.yazan ? `${x.yazan.ad} ${x.yazan.soyad}` : ""} · {tarih(x.olusturma, true)}</div>
              <p style={{ whiteSpace: "pre-wrap", color: "var(--metin)" }}>{x.metin}</p>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <KayitFormu eylem={destekYanit} dugme="Gönder">
            <input type="hidden" name="talep" value={id} />
            <textarea name="metin" rows={4} className="alan" style={{ width: "100%" }} placeholder="Yanıt" />
            <select name="durum" className="alan" defaultValue="yanitlandi"><option value="yanitlandi">Yanıtlandı</option><option value="bekliyor">Dershaneden bilgi bekleniyor</option><option value="kapandi">Kapat</option></select>
          </KayitFormu>
        </div>
      </Kart>
    </PanelKabugu>
  );
}
