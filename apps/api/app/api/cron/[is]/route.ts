import { NextResponse } from "next/server";
import { ortam } from "@/lib/ortam";
import { havuzDoldurIsi, kalibrasyonIsi } from "@/lib/isler";
import { OYUN_AYARLARI } from "@kmy/shared";
import { bugunIst, haftaBasi } from "@/lib/oyun-servisi";
import { aiBekleyenleriIsle } from "@/lib/topluluk-servisi";
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
  "havuz-doldur": async () => {
    const o = await havuzDoldurIsi(270_000);
    return { dogrulanan: o.dogrulanan, reddedilen: o.reddedilen, atilmaOrani: o.atilmaOrani, ciftSayisi: o.raporlar.length, sureMs: o.sureMs };
  },
  kalibrasyon: async () => kalibrasyonIsi(),
  // Pazartesi 00:10 (İstanbul): geçen haftanın lig gruplarını kapat, yükselme/düşme, sezon sonu ödülü
  "lig-kapat": async () => {
    const buHafta = haftaBasi(bugunIst());
    const gecen = new Date(`${buHafta}T00:00:00Z`);
    gecen.setUTCDate(gecen.getUTCDate() - 7);
    const { data, error } = await servisIstemcisi().rpc("sistem_lig_kapat", { p_hafta: gecen.toISOString().slice(0, 10) });
    if (error) throw error;
    return data as Record<string, unknown>;
  },
  // Perşembe 09:00 (İstanbul): klan savaşı eşleştirme (savaş Cuma 18:00 – Pazar 21:00) + liderlik devri
  "klan-savas-esle": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_klan_savas_esle", {
      p_hafta: haftaBasi(bugunIst()), p_min_uye: OYUN_AYARLARI.klan.savasMinUye, p_hemen: false, p_dershane: null,
    });
    if (error) throw error;
    return { eslesen: data };
  },
  // Her 5 dk: cevapsız topluluk sorularına ipucu (15 dk), çözümsüzlere tam çözüm (2 sa)
  "topluluk-ai": async () => aiBekleyenleriIsle(),
  // Her gece: asistan sohbetleri 180 günden eskiyse silinir
  "asistan-temizle": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_asistan_temizle");
    if (error) throw error;
    return { silinen: data };
  },
  // Elle (demo/pilot): savaşı hemen başlat (bitiş yine Pazar 21:00), en az 2 üyeli klanlar
  "klan-savas-hemen": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_klan_savas_esle", {
      p_hafta: haftaBasi(bugunIst()), p_min_uye: 2, p_hemen: true, p_dershane: null,
    });
    if (error) throw error;
    return { eslesen: data };
  },
  // Pazar 21:05 (İstanbul): savaşları kapat, ödülleri ver
  "klan-savas-kapat": async () => {
    const { data, error } = await servisIstemcisi().rpc("sistem_klan_savas_kapat", { p_kupa: OYUN_AYARLARI.klan.savasKupa, p_hepsi: false });
    if (error) throw error;
    return { kapanan: data };
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
