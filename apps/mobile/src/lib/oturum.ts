import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "./supabase";

export interface Profil {
  id: string;
  dershane_id: string | null;
  tur: "ogrenci" | "veli" | "personel" | "merkez";
  takma_ad: string | null;
  veli_onayi: boolean;
  sifre_degismeli: boolean;
  kvkk_onay_tarihi: string | null;
}

export interface DershaneTema {
  ad: string;
  uygulama_ici_ad: string | null;
  ana_renk: string;
  logo_url: string | null;
}

interface OturumDurumu {
  hazir: boolean;
  oturum: Session | null;
  profil: Profil | null;
  dershane: DershaneTema | null;
  ozellikler: Record<string, boolean>;
  yukle: (oturum: Session | null) => Promise<void>;
}

export const useOturum = create<OturumDurumu>((set) => ({
  hazir: false,
  oturum: null,
  profil: null,
  dershane: null,
  ozellikler: {},
  yukle: async (oturum) => {
    if (!oturum) {
      set({ hazir: true, oturum: null, profil: null, dershane: null, ozellikler: {} });
      return;
    }
    const [{ data: profil }, { data: dershane }, { data: ozellikler }] = await Promise.all([
      supabase.from("kullanici").select("id, dershane_id, tur, takma_ad, veli_onayi, sifre_degismeli, kvkk_onay_tarihi").eq("id", oturum.user.id).maybeSingle<Profil>(),
      supabase.from("dershane").select("ad, uygulama_ici_ad, ana_renk, logo_url").maybeSingle<DershaneTema>(),
      supabase.rpc("ozelliklerim"),
    ]);
    set({
      hazir: true,
      oturum,
      profil: profil ?? null,
      dershane: dershane ?? null,
      ozellikler: Object.fromEntries(((ozellikler ?? []) as Array<{ kod: string; acik: boolean }>).map((o) => [o.kod, o.acik])),
    });
  },
}));

/** Veritabanından gelen i18n anahtarlı hatayı ("giris.kodGecersiz") anahtara çevirir. */
export function hataAnahtari(mesaj: string | undefined): string | null {
  return mesaj && /^[a-z]+\.[A-Za-z]+$/.test(mesaj) ? mesaj : null;
}
