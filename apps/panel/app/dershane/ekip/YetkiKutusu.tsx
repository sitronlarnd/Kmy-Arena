"use client";

import { useOptimistic, useTransition } from "react";
import type { KayitSonucu } from "@/app/dershane/kayit/eylemler";

export function YetkiKutusu({ acik, eylem }: { acik: boolean; eylem: (acik: boolean) => Promise<KayitSonucu> }) {
  const [deger, setDeger] = useOptimistic(acik);
  const [bekliyor, basla] = useTransition();
  return (
    <input type="checkbox" checked={deger} disabled={bekliyor} style={{ width: 18, height: 18, accentColor: "var(--vurgu)" }}
      onChange={(e) => { const v = e.target.checked; basla(async () => { setDeger(v); await eylem(v); }); }} />
  );
}
