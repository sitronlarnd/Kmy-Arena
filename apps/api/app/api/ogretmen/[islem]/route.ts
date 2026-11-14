import { govdeOku, guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { kimlikDogrula } from "@/lib/kimlik";
import { fotograftanOku, ogretmenGetir, soruUrettir } from "@/lib/ogretmen-servisi";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const OPTIONS = onUcus;

/** uret {kazanimId, zorluk, adet} · oku {gorsel} — öğretmen paneli sunucusu çağırır (kullanıcı jetonuyla). */
export async function POST(istek: Request, { params }: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await params;
    const kim = await kimlikDogrula(istek);
    const g = await govdeOku(istek);
    if (islem === "uret") {
      const o = await ogretmenGetir(kim.id, "soru.ai_uret");
      if (typeof g.kazanimId !== "string" || !/^[0-9a-f-]{36}$/i.test(g.kazanimId)) throw new IstemciHatasi("soru.kazanimYok", 400);
      return json(await soruUrettir(o, { kazanimId: g.kazanimId, zorluk: Number(g.zorluk) || 5, adet: Number(g.adet) || 3 }));
    }
    if (islem === "oku") {
      const o = await ogretmenGetir(kim.id, "soru.yukle");
      return json(await fotograftanOku(o, typeof g.gorsel === "string" ? g.gorsel : ""));
    }
    throw new IstemciHatasi("ortak.hata", 404);
  });
}
