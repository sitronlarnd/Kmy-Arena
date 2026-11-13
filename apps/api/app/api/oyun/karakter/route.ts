import { govdeOku, guvenli, json, onUcus } from "@/lib/http";
import { ogrenciGetir } from "@/lib/kimlik";
import { karakterSec } from "@/lib/oyun-servisi";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await ogrenciGetir(istek);
    const g = await govdeOku(istek);
    await karakterSec(k, String(g.tur ?? ""));
    return json({ tamam: true });
  });
}
