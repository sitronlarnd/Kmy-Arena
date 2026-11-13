import { guvenli, json, onUcus } from "@/lib/http";
import { servisIstemcisi } from "@/lib/supabase";
import { yonetimYetkisi } from "@/lib/yonetim-yetki";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/** AI hattı tanılama: son AI çağrıları (kişisel veri yok) ve son reddedilen sorular. */
export async function GET(istek: Request) {
  return guvenli(async () => {
    await yonetimYetkisi(istek, "merkez.ai_yonet");
    const s = servisIstemcisi();
    const [log, red, ozet] = await Promise.all([
      s.from("ai_cagri_log").select("olusturma, amac, model, token_giris, token_cikis, sure_ms, basarili, hata, prompt_surumu").order("olusturma", { ascending: false }).limit(40),
      s.from("soru").select("olusturma, zorluk, red_nedeni, uretici_model, dogrulayici_model").eq("durum", "reddedildi").order("olusturma", { ascending: false }).limit(15),
      s.from("soru").select("durum, uretici_model, red_nedeni").eq("kaynak", "ai").limit(10000),
    ]);
    const durumlar: Record<string, number> = {};
    const modeller: Record<string, Record<string, number>> = {};
    for (const r of ozet.data ?? []) {
      durumlar[r.durum as string] = (durumlar[r.durum as string] ?? 0) + 1;
      const m = (modeller[String(r.uretici_model)] ??= {});
      const anahtar = r.durum === "reddedildi" ? `red:${String(r.red_nedeni ?? "").split(":")[0]}` : String(r.durum);
      m[anahtar] = (m[anahtar] ?? 0) + 1;
    }
    return json({ aiCagrilari: log.data, sonRedler: red.data, soruDurumlari: durumlar, ureticiModelBazinda: modeller });
  });
}
