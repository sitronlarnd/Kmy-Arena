import { Kart, PanelKabugu } from "@/bilesenler/PanelKabugu";
import { tarih } from "@/lib/panel";
import { servis } from "@/lib/servis";
import { merkezYetkisi, paneliKoru } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Denetim({ searchParams }: { searchParams: Promise<{ islem?: string; dershane?: string; sayfa?: string }> }) {
  await paneliKoru("merkez");
  await merkezYetkisi("merkez.denetim_oku");
  const p = await searchParams;
  const sayfa = Math.max(0, Number(p.sayfa) || 0);
  const s = servis();
  let q = s.from("denetim_log").select("id, islem, hedef, ayrinti, olusturma, dershane:dershane_id(ad), kullanici:kullanici_id(ad, soyad, tur)").order("olusturma", { ascending: false }).range(sayfa * 100, sayfa * 100 + 99);
  if (p.islem) q = q.ilike("islem", `%${p.islem}%`);
  if (p.dershane) q = q.eq("dershane_id", p.dershane);
  const [{ data }, { data: dershaneler }] = await Promise.all([q, s.from("dershane").select("id, ad").order("ad")]);
  return (
    <PanelKabugu baslik="Denetim kayıtları" panel="merkez" aktif="/merkez/denetim">
      <Kart genis>
        <form className="form" method="get">
          <input name="islem" defaultValue={p.islem ?? ""} placeholder="İşlem (ör. dershane., moderasyon., hesap.)" className="alan" />
          <select name="dershane" defaultValue={p.dershane ?? ""} className="alan"><option value="">Tüm dershaneler</option>{(dershaneler ?? []).map((d) => <option key={d.id as string} value={d.id as string}>{d.ad as string}</option>)}</select>
          <button className="dugme">Filtrele</button>
        </form>
        <div className="kaydir" style={{ marginTop: 12 }}>
          <table className="tablo"><thead><tr><th>Zaman</th><th>Kim</th><th>Dershane</th><th>İşlem</th><th>Hedef</th><th>Ayrıntı</th></tr></thead>
            <tbody>{((data ?? []) as unknown as { id: number; islem: string; hedef: string | null; ayrinti: unknown; olusturma: string; dershane: { ad: string } | null; kullanici: { ad: string; soyad: string; tur: string } | null }[]).map((x) => (
              <tr key={x.id}><td className="kucuk">{tarih(x.olusturma, true)}</td><td>{x.kullanici ? `${x.kullanici.ad} ${x.kullanici.soyad}` : "sistem"}{x.kullanici?.tur === "merkez" && <span className="rozet vurgu" style={{ marginLeft: 4 }}>merkez</span>}</td>
                <td>{x.dershane?.ad ?? "—"}</td><td><code>{x.islem}</code></td><td className="kucuk">{x.hedef}</td><td className="kucuk soluk"><code>{JSON.stringify(x.ayrinti).slice(0, 140)}</code></td></tr>
            ))}</tbody></table>
        </div>
        <div className="form" style={{ marginTop: 10 }}>
          {sayfa > 0 && <a className="dugme kucuk ikincil" href={`?islem=${p.islem ?? ""}&dershane=${p.dershane ?? ""}&sayfa=${sayfa - 1}`}>← Önceki</a>}
          {(data ?? []).length === 100 && <a className="dugme kucuk ikincil" href={`?islem=${p.islem ?? ""}&dershane=${p.dershane ?? ""}&sayfa=${sayfa + 1}`}>Sonraki →</a>}
        </div>
      </Kart>
    </PanelKabugu>
  );
}
