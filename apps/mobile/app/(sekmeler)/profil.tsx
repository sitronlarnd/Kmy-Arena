import { t } from "@kmy/shared/i18n";
import { Text } from "react-native";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

export default function Profil() {
  const tema = useTema();
  const { profil, dershane } = useOturum();
  return (
    <Ekran baslik={t("sekmeler.profil")}>
      <Text style={{ color: tema.metin, fontSize: 20, fontWeight: "700" }}>{profil?.takma_ad ?? "-"}</Text>
      <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{dershane?.ad ?? ""}</Text>
      <Dugme ikincil baslik={t("giris.cikisYap")} onPress={() => void supabase.auth.signOut()} />
    </Ekran>
  );
}
