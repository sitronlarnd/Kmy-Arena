import { NextResponse } from "next/server";
import { ortam } from "@/lib/ortam";
import { servisIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Is = () => Promise<Record<string, unknown>>;

/**
 * Arka plan işleri (Vercel Cron). Yeni işler fazlarla eklenir:
 *  Faz 1: havuz-doldur (soru üretim + doğrulama), kalibrasyon
 *  Faz 2: lig-hafta-sonu, sezon-sonu
 *  Faz 6: veli-raporu, risk-skoru, planli-raporlar
 *  Faz 7: pilot-raporu (30 gün sonunda dershaneye otomatik etki raporu)
 */
const ISLER: Record<string, Is> = {
  "cevap-bolumu": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_cevap_bolumu_olustur");
    if (error) throw error;
    return { bolum: data };
  },
};

export async function GET(istek: Request, baglam: { params: Promise<{ is: string }> }): Promise<NextResponse> {
  const { is: ad } = await baglam.params;
  const gizli = ortam().CRON_SECRET;
  // Vercel Cron, CRON_SECRET tanımlıysa Authorization: Bearer <CRON_SECRET> gönderir.
  if (!gizli || istek.headers.get("authorization") !== `Bearer ${gizli}`) {
    return NextResponse.json({ hata: "yetkisiz" }, { status: 401 });
  }
  const calistir = ISLER[ad];
  if (!calistir) return NextResponse.json({ hata: "bilinmeyen iş" }, { status: 404 });
  try {
    return NextResponse.json({ is: ad, sonuc: await calistir() });
  } catch (hata) {
    console.error(`cron ${ad} başarısız`, hata);
    return NextResponse.json({ is: ad, hata: hata instanceof Error ? hata.message : "bilinmiyor" }, { status: 500 });
  }
}
