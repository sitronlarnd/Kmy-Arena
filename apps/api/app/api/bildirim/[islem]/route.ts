import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { kimlikDogrula } from "@/lib/kimlik";
import { servisIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

const saat = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 23 ? x : null);
const bool = (x: unknown) => (typeof x === "boolean" ? x : null);

/** kayit / sil (cihaz jetonu), tercih (bildirim açık, sessiz saat, veli e-postası). */
export async function POST(istek: Request, { params }: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await params;
    const k = await kimlikDogrula(istek);
    const g = await govdeOku(istek);
    const s = servisIstemcisi();
    switch (islem) {
      case "kayit":
      case "sil": {
        const token = typeof g.token === "string" ? g.token : "";
        const platform = typeof g.platform === "string" && ["ios", "android", "web"].includes(g.platform) ? g.platform : "";
        if (!/^(Exponent|Expo)PushToken\[.+\]$/.test(token) || (islem === "kayit" && !platform)) throw new IstemciHatasi("ortak.hata", 400);
        const { error } = await s.rpc("sistem_bildirim_cihaz", { p_kullanici: k.id, p_token: token, p_platform: platform || "ios", p_sil: islem === "sil" });
        if (error) throw error;
        return json({ tamam: true });
      }
      case "tercih": {
        const { data, error } = await s.rpc("sistem_bildirim_tercih", {
          p_kullanici: k.id, p_acik: bool(g.acik), p_bas: saat(g.sessizBaslangic), p_bit: saat(g.sessizBitis), p_veli_eposta: bool(g.veliEposta),
        });
        if (error) throw error;
        return json(data);
      }
      default:
        throw new IstemciHatasi("ortak.hata", 404);
    }
  });
}
