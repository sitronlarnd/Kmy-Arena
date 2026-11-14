import type { KazanimSecenek } from "@/lib/api";

/** Ders gruplu kazanım seçici (sunucu bileşeni; istemci formlarında da kullanılabilir). */
export function KazanimSec({ liste, ad = "kazanim", deger, gerekli = true, onDegis }: { liste: KazanimSecenek[]; ad?: string; deger?: string | null; gerekli?: boolean; onDegis?: (v: string) => void }) {
  const gruplar = new Map<string, KazanimSecenek[]>();
  for (const k of liste) gruplar.set(`${k.sinav} · ${k.ders}`, [...(gruplar.get(`${k.sinav} · ${k.ders}`) ?? []), k]);
  return (
    <select name={ad} required={gerekli} className="alan" style={{ maxWidth: 420 }} {...(onDegis ? { value: deger ?? "", onChange: (e) => onDegis(e.target.value) } : { defaultValue: deger ?? "" })}>
      <option value="">Kazanım seç…</option>
      {[...gruplar.entries()].map(([g, l]) => (
        <optgroup key={g} label={g}>{l.map((k) => <option key={k.id} value={k.id}>{k.kod} — {k.aciklama.slice(0, 80)}</option>)}</optgroup>
      ))}
    </select>
  );
}
