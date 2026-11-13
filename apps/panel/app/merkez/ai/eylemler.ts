"use server";

import { AI_GOREVLERI } from "@kmy/ai";
import { revalidatePath } from "next/cache";
import { denetle, servis } from "@/lib/servis";
import { merkezYetkisi } from "@/lib/yetki";

/**
 * AI Merkezi işlemleri. Her değişiklik yeni bir SÜRÜM olarak yayınlanır,
 * öncekisi arşive gider; "Geri al" bir önceki sürümü yeniden yayınlar.
 * API ayarları 60 sn önbellekte tutar → değişiklik en geç 1 dakikada geçerli.
 */

const sayi = (d: FormDataEntryValue | null, min: number, max: number): number | null => {
  if (d === null || d === "") return null;
  const n = Number(d);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`Geçersiz değer: ${String(d)}`);
  return n;
};

async function yayinla(gorev: string, alanlar: Record<string, unknown>, kullanici: string, islem: string): Promise<void> {
  const s = servis();
  const { data: mevcut } = await s.from("ai_gorev_ayari").select("id, surum").eq("gorev", gorev).eq("kapsam", "genel").order("surum", { ascending: false }).limit(1);
  const surum = (mevcut?.[0]?.surum ?? 0) + 1;
  const { error: h1 } = await s.from("ai_gorev_ayari").update({ durum: "arsiv" }).eq("gorev", gorev).eq("kapsam", "genel").eq("durum", "yayinda");
  if (h1) throw new Error(h1.message);
  const { error: h2 } = await s.from("ai_gorev_ayari").insert({
    gorev, kapsam: "genel", surum, durum: "yayinda", yayinlayan: kullanici, yayin_tarihi: new Date().toISOString(), ...alanlar,
  });
  if (h2) throw new Error(h2.message);
  await denetle(kullanici, islem, `ai_gorev_ayari:${gorev}`, { surum, ...alanlar });
}

export async function ayarYayinla(form: FormData): Promise<void> {
  const kullanici = await merkezYetkisi("merkez.ai_yonet");
  const gorev = String(form.get("gorev"));
  if (!(AI_GOREVLERI as readonly string[]).includes(gorev)) throw new Error("Bilinmeyen görev");
  const birincil = String(form.get("model_birincil") ?? "").trim();
  const yedek = String(form.get("model_yedek") ?? "").trim();
  // Karar #4: yalnızca Claude modelleri
  for (const m of [birincil, yedek].filter(Boolean)) {
    if (!/^claude-[a-z0-9.-]+$/.test(m)) throw new Error(`Yalnızca Claude modelleri kullanılabilir: ${m}`);
  }
  await yayinla(
    gorev,
    {
      model_birincil: birincil,
      model_yedek: yedek || null,
      sicaklik: sayi(form.get("sicaklik"), 0, 1),
      max_token: sayi(form.get("max_token"), 50, 8000),
      zaman_asimi_ms: sayi(form.get("zaman_asimi_ms"), 2000, 120000),
      yeniden_deneme: sayi(form.get("yeniden_deneme"), 0, 3),
    },
    kullanici,
    "ai.ayar_yayinla",
  );
  revalidatePath("/merkez/ai");
}

export async function ayarGeriAl(form: FormData): Promise<void> {
  const kullanici = await merkezYetkisi("merkez.ai_yonet");
  const gorev = String(form.get("gorev"));
  const s = servis();
  const { data } = await s
    .from("ai_gorev_ayari")
    .select("surum, durum, model_birincil, model_yedek, sicaklik, max_token, zaman_asimi_ms, yeniden_deneme")
    .eq("gorev", gorev)
    .eq("kapsam", "genel")
    .order("surum", { ascending: false })
    .limit(10);
  const liste = data ?? [];
  const yayindaki = liste.find((r) => r.durum === "yayinda");
  const onceki = liste.find((r) => r.durum === "arsiv" && (!yayindaki || r.surum < yayindaki.surum));
  if (!onceki) throw new Error("Geri alınacak önceki sürüm yok");
  await yayinla(
    gorev,
    {
      model_birincil: onceki.model_birincil, model_yedek: onceki.model_yedek, sicaklik: onceki.sicaklik,
      max_token: onceki.max_token, zaman_asimi_ms: onceki.zaman_asimi_ms, yeniden_deneme: onceki.yeniden_deneme,
    },
    kullanici,
    "ai.ayar_geri_al",
  );
  revalidatePath("/merkez/ai");
}

export async function acilDurum(form: FormData): Promise<void> {
  const kullanici = await merkezYetkisi("merkez.ai_yonet");
  const yedekMod = form.get("ai_yedek_mod") === "on";
  const durdurulan = AI_GOREVLERI.filter((g) => form.get(`durdur_${g}`) === "on");
  const { error } = await servis().from("uygulama_ayari").update({ ai_yedek_mod: yedekMod, durdurulan_ai_gorevleri: durdurulan }).eq("id", true);
  if (error) throw new Error(error.message);
  await denetle(kullanici, "ai.acil_durum", "uygulama_ayari", { yedekMod, durdurulan });
  revalidatePath("/merkez/ai");
}
