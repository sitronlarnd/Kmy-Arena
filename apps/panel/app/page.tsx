import { t } from "@kmy/shared/i18n";
import { redirect } from "next/navigation";
import { paneleErisebilir, yetkilerim, type Panel } from "@/lib/yetki";

export const dynamic = "force-dynamic";

export default async function Ana({ searchParams }: { searchParams: Promise<{ yetkisiz?: string }> }) {
  const { yetkisiz } = await searchParams;
  const yetkiler = await yetkilerim();
  if (!yetkisiz) {
    for (const panel of ["merkez", "dershane", "ogretmen"] as Panel[]) {
      if (paneleErisebilir(yetkiler, panel)) redirect(`/${panel}`);
    }
  }
  return (
    <main className="giris">
      <p>{t("panel.yetkisiz")}</p>
      <a href="/cikis">{t("giris.cikisYap")}</a>
    </main>
  );
}
