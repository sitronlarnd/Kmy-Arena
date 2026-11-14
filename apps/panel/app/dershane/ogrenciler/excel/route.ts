import type { OgrenciSatiri } from "@/bilesenler/OgrenciTablosu";
import { panelRpc } from "@/lib/panel";
import { excelYaz } from "@/lib/tablo-oku";

export const dynamic = "force-dynamic";

/** Öğrenci listesi Excel dışa aktarma (RLS: panel_ogrenciler yetkisi). */
export async function GET() {
  const o = await panelRpc<OgrenciSatiri[]>("panel_ogrenciler");
  const b = await excelYaz("Öğrenciler", ["Ad", "Takma ad", "Şube", "Sınıf", "Sınav grubu", "Seviye", "Son 7 gün soru", "Doğruluk %", "Veli bağlı", "Risk puanı", "Risk nedenleri", "Son giriş"],
    o.map((x) => [x.ad, x.takma_ad, x.sube, x.sinif, x.sinav_grubu, x.seviye, x.soru7, x.dogruluk, x.veli ? "Evet" : "Hayır", x.risk.puan, x.risk.nedenler.join("; "), x.son_giris ? new Date(x.son_giris).toLocaleString("tr-TR") : ""]));
  return new Response(new Uint8Array(b), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="ogrenciler-${new Date().toISOString().slice(0, 10)}.xlsx"` },
  });
}
