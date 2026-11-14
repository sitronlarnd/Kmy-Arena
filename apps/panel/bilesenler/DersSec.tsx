/** Sınav grubuna göre gruplu ders seçici (LGS önce). */
export function DersSec({ dersler, ad = "ders" }: { dersler: { id: string; ad: string; sinav_turu: string }[]; ad?: string }) {
  const sira = ["LGS", "TYT", "AYT", "YDT"];
  return (
    <select name={ad} required className="alan">
      <option value="">Ders seç…</option>
      {sira.map((s) => (
        <optgroup key={s} label={s}>{dersler.filter((d) => d.sinav_turu === s).map((d) => <option key={d.id} value={d.id}>{d.ad} ({s})</option>)}</optgroup>
      ))}
    </select>
  );
}
