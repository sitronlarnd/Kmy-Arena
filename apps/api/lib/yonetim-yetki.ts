import "server-only";
import { IstemciHatasi } from "./http";
import { kimlikDogrula, merkezYetkisiVar } from "./kimlik";
import { ortam } from "./ortam";

/** Yönetim uçları: CRON_SECRET (otomasyon) veya verilen merkez yetkisi. */
export async function yonetimYetkisi(istek: Request, yetki: string): Promise<void> {
  const gizli = ortam().CRON_SECRET;
  if (gizli && istek.headers.get("authorization") === `Bearer ${gizli}`) return;
  const k = await kimlikDogrula(istek);
  if (!(await merkezYetkisiVar(k.id, yetki))) throw new IstemciHatasi("panel.yetkisiz", 403);
}
