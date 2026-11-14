import { kazanimKaydet } from "@/app/merkez/merkez-eylemleri";
import { KayitFormu } from "@/bilesenler/Kayit";
import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";
import { mufredatOnizle, mufredatUygula } from "./aktarim";

export const dynamic = "force-dynamic";

export default async function Mufredat({ searchParams }: { searchParams: Promise<{ ders?: string }> }) {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.mufredat_yonet");
  const { ders } = await searchParams;
  const s = servis();
  const { data: dersler } = await s.from("ders").select("id, ad, sinav_turu").order("sinav_turu").order("sira");
  const secili = ders ?? (dersler?.[0]?.id as string | undefined);
  const [{ data: uniteler }, { data: tumKz }] = await Promise.all([
    s.from("unite").select("id, kod, ad, sira, kazanimlar:kazanim(id, kod, aciklama, on_kosullar, soru_tipi_agirliklari, panel_duzenleme, sira)").eq("ders_id", secili ?? "").order("sira"),
    s.from("kazanim").select("id, kod"),
  ]);
  const kodOf = new Map((tumKz ?? []).map((x) => [x.id as string, x.kod as string]));
  type K = { id: string; kod: string; aciklama: string; on_kosullar: string[]; soru_tipi_agirliklari: Record<string, number>; panel_duzenleme: boolean; sira: number };
  return (
    <PanelKabugu baslik="Müfredat" panel="merkez" aktif="/merkez/mufredat" sag={<a className="dugme ikincil" href="/merkez/mufredat/disa">JSON dışa aktar</a>}
      yol="Panelden düzenlenen kazanımlar bir sonraki müfredat tohum yüklemesinde ezilmez. Ön koşullar kazanım kodlarıyla (virgülle) yazılır.">
      <Kart genis>
        <div className="form">{(dersler ?? []).map((d) => <a key={d.id as string} href={`?ders=${d.id as string}`} className={`dugme kucuk ${d.id === secili ? "" : "ikincil"}`}>{d.sinav_turu as string} · {d.ad as string}</a>)}</div>
      </Kart>
      <Kart genis baslik="MEB/ÖSYM güncellemesi: JSON içe aktar" aciklama="Önce önizleyin: değişen açıklamalar, yeni kazanımlar ve etkilenen öğrenci beceri kaydı sayısı gösterilir.">
        <div className="form">
          <KayitFormu eylem={mufredatOnizle} dugme="Önizle" dosya><input type="file" name="dosya" accept=".json" required className="alan" /></KayitFormu>
          <KayitFormu eylem={mufredatUygula} dugme="Uygula" dosya><input type="file" name="dosya" accept=".json" required className="alan" /></KayitFormu>
        </div>
      </Kart>
      {((uniteler ?? []) as unknown as { id: string; kod: string; ad: string; kazanimlar: K[] }[]).map((u) => (
        <Kart key={u.id} genis baslik={`${u.kod} · ${u.ad}`}>
          <div style={{ display: "grid", gap: 6 }}>
            {[...u.kazanimlar].sort((a, b) => a.sira - b.sira || a.kod.localeCompare(b.kod)).map((k) => (
              <details key={k.id}>
                <summary><code>{k.kod}</code> {k.aciklama} {k.panel_duzenleme && <span className="rozet vurgu">panelden</span>} {k.on_kosullar.length > 0 && <span className="soluk kucuk">← {k.on_kosullar.map((x) => kodOf.get(x)).join(", ")}</span>}</summary>
                <KayitFormu eylem={kazanimKaydet} dugme="Kaydet">
                  <input type="hidden" name="id" value={k.id} />
                  <input name="aciklama" defaultValue={k.aciklama} className="alan" style={{ width: "100%" }} />
                  <input name="onkosul" defaultValue={k.on_kosullar.map((x) => kodOf.get(x)).join(", ")} placeholder="Ön koşul kodları" className="alan" style={{ minWidth: 260 }} />
                  <input name="agirlik" defaultValue={Object.keys(k.soru_tipi_agirliklari ?? {}).length ? JSON.stringify(k.soru_tipi_agirliklari) : ""} placeholder='Soru tipi ağırlıkları {"yorum":0.4}' className="alan" style={{ minWidth: 260 }} />
                </KayitFormu>
              </details>
            ))}
            <details><summary className="kucuk">+ Bu üniteye kazanım ekle</summary>
              <KayitFormu eylem={kazanimKaydet} dugme="Ekle">
                <input type="hidden" name="unite" value={u.id} />
                <input name="kod" required placeholder="Kod (ör. M.8.1.5.1)" className="alan" />
                <input name="aciklama" required placeholder="Açıklama" className="alan" style={{ minWidth: 320 }} />
                <input name="onkosul" placeholder="Ön koşul kodları" className="alan" />
              </KayitFormu>
            </details>
          </div>
        </Kart>
      ))}
    </PanelKabugu>
  );
}
