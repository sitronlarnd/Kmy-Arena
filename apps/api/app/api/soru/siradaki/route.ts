import type { SiradakiIstegi } from "@kmy/shared";
import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { siradakiSoru } from "@/lib/soru-servisi";

export const dynamic = "force-dynamic";
// Havuz boşsa yanıttan sonra arka planda üretim yapılır (after)
export const maxDuration = 300;

const MODLAR = new Set(["antrenman", "tekrar", "tespit", "odev"]);
const kod = (d: unknown): string | undefined => (typeof d === "string" && /^[\p{L}\p{N}._-]{1,40}$/u.test(d) ? d : undefined);

export const OPTIONS = onUcus;

/** Sıradaki soru: cevap anahtarı olmadan. Hedef < 1,5 sn (havuzdan). */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    if (k.tur !== "ogrenci") throw new IstemciHatasi("soru.yalnizcaOgrenci", 403);
    const g = await govdeOku(istek);
    const mod = typeof g.mod === "string" && MODLAR.has(g.mod) ? (g.mod as SiradakiIstegi["mod"]) : "antrenman";
    const ist: SiradakiIstegi = { mod };
    const kazanim = kod(g.kazanimKodu);
    const ders = kod(g.dersKodu);
    const tespit = kod(g.tespitDersKodu);
    if (kazanim) ist.kazanimKodu = kazanim;
    if (ders) ist.dersKodu = ders;
    if (tespit) ist.tespitDersKodu = tespit;
    if (typeof g.odevId === "string" && /^[0-9a-f-]{36}$/i.test(g.odevId)) ist.odevId = g.odevId;
    return json(await siradakiSoru(k, ist));
  });
}
