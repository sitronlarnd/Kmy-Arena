import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { epostaGonder } from "@/lib/eposta";
import { servisIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

const IP_SAYAC = new Map<string, { n: number; bas: number }>();

/** E-posta bildirimi (isteğe bağlı): RESEND_API_KEY ve SAHIP_EPOSTA tanımlıysa. */
async function eposta(kime: string, konu: string, metin: string): Promise<void> {
  await epostaGonder(kime, konu, metin);
}

const metin = (d: unknown, max: number) => (typeof d === "string" ? d.trim().replace(/\s+/g, " ").slice(0, max) : "");

/** Tanıtım sitesi: teklif / 30 gün pilot formu (oturumsuz, IP başına saatte 5). */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const ip = istek.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
    const s = IP_SAYAC.get(ip);
    const simdi = Date.now();
    if (s && simdi - s.bas < 3_600_000 && s.n >= 5) throw new IstemciHatasi("teklif.cokFazla", 429);
    IP_SAYAC.set(ip, s && simdi - s.bas < 3_600_000 ? { n: s.n + 1, bas: s.bas } : { n: 1, bas: simdi });

    const g = await govdeOku(istek);
    if (metin(g.web_sitesi, 10)) return json({ tamam: true }); // bal tuzağı
    const kayit = {
      dershane_adi: metin(g.dershane_adi, 120),
      sehir: metin(g.sehir, 60),
      sube_sayisi: Math.min(500, Math.max(1, Number(g.sube_sayisi) || 1)),
      ogrenci_sayisi: Math.min(100000, Math.max(1, Number(g.ogrenci_sayisi) || 1)),
      yetkili: metin(g.yetkili, 120),
      telefon: metin(g.telefon, 30) || null,
      eposta: metin(g.eposta, 160),
      not: metin(g.not, 1000) || null,
      pilot_talebi: g.pilot === true,
    };
    if (kayit.dershane_adi.length < 2 || kayit.sehir.length < 2 || kayit.yetkili.length < 2) throw new IstemciHatasi("teklif.eksik");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kayit.eposta)) throw new IstemciHatasi("teklif.eposta");
    if (kayit.telefon && !/^[+\d][\d\s()-]{6,}$/.test(kayit.telefon)) throw new IstemciHatasi("teklif.telefon");
    const { error } = await servisIstemcisi().from("teklif").insert(kayit);
    if (error) throw error;
    const satis = process.env.SAHIP_EPOSTA;
    if (satis) {
      await eposta(satis, `Yeni ${kayit.pilot_talebi ? "pilot" : "teklif"} talebi: ${kayit.dershane_adi} (${kayit.sehir})`,
        `${kayit.yetkili} · ${kayit.eposta} · ${kayit.telefon ?? "-"}\nŞube: ${kayit.sube_sayisi} · Öğrenci: ${kayit.ogrenci_sayisi}\n\n${kayit.not ?? ""}`);
    }
    await eposta(kayit.eposta, "KMY Arena — talebinizi aldık",
      `Merhaba ${kayit.yetkili},\n\n${kayit.dershane_adi} için ${kayit.pilot_talebi ? "30 günlük ücretsiz pilot" : "teklif"} talebinizi aldık. En geç bir iş günü içinde sizi arayacağız.\n\nKMY Arena`);
    return json({ tamam: true });
  });
}
