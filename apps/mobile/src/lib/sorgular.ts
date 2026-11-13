import { useQuery } from "@tanstack/react-query";
import type { Ustalik } from "@kmy/shared";
import { useOturum } from "./oturum";
import { supabase } from "./supabase";

/** Öğrencinin kendi verileri — RLS ile yalnızca kendisi okur; yazma API'de. */

export interface Ilerleme {
  xp: number;
  altin: number;
  seviye: number;
  seri_dogru: number;
  toplam_cevap: number;
  toplam_dogru: number;
  ozellik_puanlari: Record<string, number>;
}

export function useIlerleme() {
  const id = useOturum((s) => s.oturum?.user.id);
  return useQuery({
    queryKey: ["ilerleme", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Ilerleme> => {
      const { data, error } = await supabase
        .from("ogrenci_ilerleme")
        .select("xp, altin, seviye, seri_dogru, toplam_cevap, toplam_dogru, ozellik_puanlari")
        .eq("kullanici_id", id ?? "")
        .maybeSingle();
      if (error) throw error;
      return (data as Ilerleme | null) ?? { xp: 0, altin: 0, seviye: 1, seri_dogru: 0, toplam_cevap: 0, toplam_dogru: 0, ozellik_puanlari: {} };
    },
  });
}

export interface Ders {
  id: string;
  kod: string;
  ad: string;
  sinav_turu: string;
}

export interface HaritaKazanimi {
  id: string;
  kod: string;
  aciklama: string;
  on_kosullar: string[];
  sira: number;
}

export interface HaritaUnitesi {
  id: string;
  ad: string;
  sira: number;
  kazanimlar: HaritaKazanimi[];
}

export interface HaritaDersi extends Ders {
  uniteler: HaritaUnitesi[];
}

/** Öğrencinin paketine ve sınıfına (LGS / YKS, alan) göre açık dersleri ve müfredatı. */
export function useMufredat() {
  const id = useOturum((s) => s.oturum?.user.id);
  return useQuery({
    queryKey: ["mufredat", id],
    enabled: Boolean(id),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<HaritaDersi[]> => {
      const { data: izinli, error: h1 } = await supabase.rpc("derslerim");
      if (h1) throw h1;
      const idler = ((izinli ?? []) as Array<{ id: string }>).map((d) => d.id);
      if (idler.length === 0) return [];
      const { data, error } = await supabase
        .from("ders")
        .select("id, kod, ad, sinav_turu, sira, uniteler:unite (id, ad, sira, kazanimlar:kazanim (id, kod, aciklama, on_kosullar, sira))")
        .in("id", idler)
        .order("sira");
      if (error) throw error;
      return ((data ?? []) as unknown as Array<HaritaDersi & { sira: number }>).map((d) => ({
        ...d,
        uniteler: [...d.uniteler].sort((a, b) => a.sira - b.sira).map((u) => ({ ...u, kazanimlar: [...u.kazanimlar].sort((a, b) => a.sira - b.sira) })),
      }));
    },
  });
}

export interface Beceri {
  kazanim_id: string;
  theta: number;
  cozulen: number;
  ustalik: Ustalik;
}

export function useBeceriler() {
  const id = useOturum((s) => s.oturum?.user.id);
  return useQuery({
    queryKey: ["beceri", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Map<string, Beceri>> => {
      const { data, error } = await supabase.from("beceri").select("kazanim_id, theta, cozulen, ustalik").eq("kullanici_id", id ?? "");
      if (error) throw error;
      return new Map(((data ?? []) as Beceri[]).map((b) => [b.kazanim_id, b]));
    },
  });
}

export interface HataKaydi {
  id: string;
  kazanim_kodu: string;
  kazanim: string;
  ders: string;
  govde_md: string;
  siklar: Record<string, string>;
  dogru: string;
  secilen: string | null;
  cozum_adimlari: string[];
  asama: number;
  sonraki_tekrar: string;
  vadesi_geldi: boolean;
}

export function useHataDefteri() {
  const id = useOturum((s) => s.oturum?.user.id);
  return useQuery({
    queryKey: ["hata-defteri", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<HataKaydi[]> => {
      const { data, error } = await supabase.rpc("hata_defterim");
      if (error) throw error;
      return (data ?? []) as HataKaydi[];
    },
  });
}

export function useTespitler() {
  const id = useOturum((s) => s.oturum?.user.id);
  return useQuery({
    queryKey: ["tespit", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<Map<string, { bitti: boolean }>> => {
      const { data, error } = await supabase.from("tespit_oturumu").select("ders_id, bitis").eq("kullanici_id", id ?? "");
      if (error) throw error;
      const m = new Map<string, { bitti: boolean }>();
      for (const r of data ?? []) if (!m.get(r.ders_id)?.bitti) m.set(r.ders_id, { bitti: r.bitis !== null });
      return m;
    },
  });
}
