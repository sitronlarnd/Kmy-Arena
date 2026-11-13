import { t } from "@kmy/shared/i18n";
import { Ekran, Yakinda } from "@/bilesenler/Ekran";

export default function Sekme() {
  return (
    <Ekran baslik={t("sekmeler.klan")}>
      <Yakinda />
    </Ekran>
  );
}
