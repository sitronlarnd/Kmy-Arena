import { sunucuIstemcisi } from "@/lib/supabase";

/** Dershane / öğretmen panelinde: merkez duyuruları ve "merkez destek ekibi görüntülüyor" bandı. */
export async function PanelBantlari() {
  const s = await sunucuIstemcisi();
  const [{ data: duyurular }, { data: izleme }] = await Promise.all([
    s.from("merkez_duyuru").select("id, baslik, metin").order("olusturma", { ascending: false }).limit(3),
    s.from("destek_goruntuleme").select("id").gt("bitis", new Date().toISOString()).limit(1),
  ]);
  if (!(duyurular ?? []).length && !(izleme ?? []).length) return null;
  return (
    <div className="bantlar">
      {(izleme ?? []).length > 0 && <div className="bant uyari">Merkez destek ekibi şu an dershanenizi salt okunur görüntülüyor. İşlem denetim kaydına yazılır.</div>}
      {(duyurular ?? []).map((d) => <div key={d.id as string} className="bant"><b>{d.baslik as string}</b> — {d.metin as string}</div>)}
    </div>
  );
}
