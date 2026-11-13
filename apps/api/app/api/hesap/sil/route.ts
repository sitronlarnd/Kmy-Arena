import { guvenli, json, onUcus } from "@/lib/http";
import { kimlikDogrula } from "@/lib/kimlik";
import { servisIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const OPTIONS = onUcus;

/**
 * Uygulama içinden hesap silme (mağaza zorunluluğu): talep anında hesap
 * kullanılamaz olur; 30 gün sonra cron (hesap-sil) kişisel veriyi kalıcı siler.
 * Bu sürede dershaneye yazılı başvuruyla geri alınabilir.
 */
export async function POST(istek: Request) {
  return guvenli(async () => {
    const k = await kimlikDogrula(istek);
    const s = servisIstemcisi();
    await s.from("kullanici").update({ silinme_talebi: new Date().toISOString() }).eq("id", k.id);
    await s.from("denetim_log").insert({ kullanici_id: k.id, islem: "hesap.silme_talebi", hedef: k.id });
    return json({ tamam: true, kalicilik: "30 gün" });
  });
}
