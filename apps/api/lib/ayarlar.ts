import "server-only";
import {
  gorevAyariCoz,
  ortamdanVarsayilanlar,
  SORU_DOGRULAMA_VARSAYILAN,
  SORU_URETIM_VARSAYILAN,
  type AiGorevi,
  type GorevAyari,
  type PromptSurumu,
} from "@kmy/ai";
import { ayarlariBirlestir, OYUN_AYARLARI, type OyunAyarlari } from "@kmy/shared";
import { onbellekli } from "./onbellek";
import { hamOrtam } from "./ortam";
import { servisIstemcisi } from "./supabase";

const DAKIKA = 60_000;

// ── Oyun ekonomisi (Merkez Panel > yayındaki sürüm) ──
const oyun = onbellekli(DAKIKA, async (): Promise<OyunAyarlari> => {
  const { data } = await servisIstemcisi().from("oyun_ayari_surumu").select("ayarlar").eq("durum", "yayinda").maybeSingle();
  return ayarlariBirlestir(OYUN_AYARLARI, (data?.ayarlar ?? null) as Parameters<typeof ayarlariBirlestir>[1]);
});
export const oyunAyarlari = oyun.al;

// ── AI görev ayarları ve promptlar ──
export interface AiAyarlari {
  gorevler: Record<AiGorevi, GorevAyari>;
  promptlar: { soru_uretim: PromptSurumu; soru_dogrulama: PromptSurumu };
  yedekMod: boolean;
  durdurulan: ReadonlySet<string>;
}

interface AyarSatiri {
  gorev: AiGorevi;
  model_birincil: string;
  model_yedek: string | null;
  sicaklik: number | null;
  max_token: number | null;
  zaman_asimi_ms: number | null;
  yeniden_deneme: number | null;
}

const ai = onbellekli(DAKIKA, async (): Promise<AiAyarlari> => {
  const s = servisIstemcisi();
  const [ayar, prompt, uygulama] = await Promise.all([
    s.from("ai_gorev_ayari").select("gorev, model_birincil, model_yedek, sicaklik, max_token, zaman_asimi_ms, yeniden_deneme").eq("durum", "yayinda").eq("kapsam", "genel"),
    s.from("prompt_surumu").select("gorev, surum, metin").eq("durum", "aktif"),
    s.from("uygulama_ayari").select("ai_yedek_mod, durdurulan_ai_gorevleri").maybeSingle(),
  ]);
  const taban = ortamdanVarsayilanlar(hamOrtam());
  const gorevler = { ...taban };
  for (const r of (ayar.data ?? []) as AyarSatiri[]) {
    if (!(r.gorev in taban)) continue;
    gorevler[r.gorev] = gorevAyariCoz(taban[r.gorev], {
      genel: {
        modelBirincil: r.model_birincil,
        ...(r.model_yedek ? { modelYedek: r.model_yedek } : {}),
        ...(r.sicaklik !== null ? { sicaklik: Number(r.sicaklik) } : {}),
        ...(r.max_token !== null ? { maxToken: r.max_token } : {}),
        ...(r.zaman_asimi_ms !== null ? { zamanAsimiMs: r.zaman_asimi_ms } : {}),
        ...(r.yeniden_deneme !== null ? { yenidenDeneme: r.yeniden_deneme } : {}),
      },
    });
  }
  const aktif = (gorev: string, varsayilan: PromptSurumu): PromptSurumu => {
    const p = (prompt.data ?? []).find((x) => x.gorev === gorev);
    return p ? { surum: p.surum as string, metin: p.metin as string } : varsayilan;
  };
  return {
    gorevler,
    promptlar: { soru_uretim: aktif("soru_uretim", SORU_URETIM_VARSAYILAN), soru_dogrulama: aktif("soru_dogrulama", SORU_DOGRULAMA_VARSAYILAN) },
    yedekMod: Boolean(uygulama.data?.ai_yedek_mod),
    durdurulan: new Set((uygulama.data?.durdurulan_ai_gorevleri ?? []) as string[]),
  };
});
export const aiAyarlari = ai.al;

// ── Müfredat (nadiren değişir) ──
export interface MufredatKazanimi {
  id: string;
  kod: string;
  aciklama: string;
  sinifDuzeyi: number;
  sinav: "LGS" | "TYT" | "AYT" | "YDT";
  soruTipiAgirliklari: Record<string, number>;
  dersId: string;
  dersKod: string;
  dersAd: string;
  ozellik: string;
  sira: number;
}

export interface Mufredat {
  kazanimlar: Map<string, MufredatKazanimi>;
  kodla: Map<string, MufredatKazanimi>;
  derseGore: Map<string, MufredatKazanimi[]>;
  dersKodla: Map<string, { id: string; kod: string; ad: string; sinav: string }>;
}

const mufredat = onbellekli(5 * DAKIKA, async (): Promise<Mufredat> => {
  const s = servisIstemcisi();
  const [dersler, kazanimlar] = await Promise.all([
    s.from("ders").select("id, kod, ad, sinav_turu, ozellik, sira"),
    s.from("kazanim").select("id, kod, aciklama, sinif_duzeyi, sinav_turu, soru_tipi_agirliklari, sira, unite:unite_id (ders_id, sira)"),
  ]);
  if (dersler.error) throw dersler.error;
  if (kazanimlar.error) throw kazanimlar.error;
  const dersMap = new Map(dersler.data.map((d) => [d.id as string, d]));
  const m: Mufredat = { kazanimlar: new Map(), kodla: new Map(), derseGore: new Map(), dersKodla: new Map() };
  for (const d of dersler.data) m.dersKodla.set(d.kod, { id: d.id, kod: d.kod, ad: d.ad, sinav: d.sinav_turu });
  const sirali = [...kazanimlar.data].sort((a, b) => {
    const ua = a.unite as unknown as { sira: number };
    const ub = b.unite as unknown as { sira: number };
    return ua.sira - ub.sira || (a.sira as number) - (b.sira as number);
  });
  for (const k of sirali) {
    const unite = k.unite as unknown as { ders_id: string };
    const ders = dersMap.get(unite.ders_id);
    if (!ders) continue;
    const kz: MufredatKazanimi = {
      id: k.id, kod: k.kod, aciklama: k.aciklama, sinifDuzeyi: k.sinif_duzeyi, sinav: k.sinav_turu,
      soruTipiAgirliklari: (k.soru_tipi_agirliklari ?? {}) as Record<string, number>,
      dersId: ders.id, dersKod: ders.kod, dersAd: ders.ad, ozellik: ders.ozellik, sira: k.sira,
    };
    m.kazanimlar.set(kz.id, kz);
    m.kodla.set(kz.kod, kz);
    const liste = m.derseGore.get(ders.id) ?? [];
    liste.push(kz);
    m.derseGore.set(ders.id, liste);
  }
  return m;
});
export const mufredatGetir = mufredat.al;
