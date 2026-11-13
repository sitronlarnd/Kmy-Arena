import { NextResponse } from "next/server";
import { servisIstemcisi } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Sistem sağlığı: API ayakta mı, veritabanına ulaşıyor mu, bakım modu açık mı. */
export async function GET(): Promise<NextResponse> {
  const baslangic = Date.now();
  try {
    const { data, error } = await servisIstemcisi()
      .from("uygulama_ayari")
      .select("min_surum, bakim_modu, bakim_mesaji")
      .single();
    if (error) throw error;
    return NextResponse.json({
      durum: "ok",
      veritabani: "ok",
      gecikmeMs: Date.now() - baslangic,
      minSurum: data.min_surum,
      bakimModu: data.bakim_modu,
      bakimMesaji: data.bakim_mesaji,
      kmyaiAnahtari: Boolean(process.env.KMYAI_API_KEY),
      zaman: new Date().toISOString(),
    });
  } catch (hata) {
    return NextResponse.json(
      { durum: "hata", veritabani: "ulasilamiyor", mesaj: hata instanceof Error ? hata.message : "bilinmiyor" },
      { status: 503 },
    );
  }
}
