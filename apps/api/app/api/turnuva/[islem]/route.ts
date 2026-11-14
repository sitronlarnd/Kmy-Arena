import { turnuvaMaclariniHazirla } from "@/lib/duello-servisi";
import { guvenli, IstemciHatasi, json, onUcus } from "@/lib/http";
import { kimlikDogrula, ogrenciGetir } from "@/lib/kimlik";
import { ogretmenGetir } from "@/lib/ogretmen-servisi";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const OPTIONS = onUcus;

/** hazirla: öğrenci turnuva ekranını açınca bekleyen maç düellolarını hemen açar. */
export async function POST(istek: Request, { params }: { params: Promise<{ islem: string }> }) {
  return guvenli(async () => {
    const { islem } = await params;
    if (islem === "ogretmen-hazirla") {
      await ogretmenGetir((await kimlikDogrula(istek)).id, "soru.yukle");
      return json(await turnuvaMaclariniHazirla());
    }
    await ogrenciGetir(istek);
    if (islem === "hazirla") return json(await turnuvaMaclariniHazirla());
    throw new IstemciHatasi("ortak.hata", 404);
  });
}
