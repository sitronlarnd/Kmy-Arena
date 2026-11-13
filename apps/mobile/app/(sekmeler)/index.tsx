import { t } from "@kmy/shared/i18n";
import { useState } from "react";
import { Text, View } from "react-native";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { useOturum } from "@/lib/oturum";
import { BOYUT, useTema } from "@/lib/tema";

export default function Arena() {
  const tema = useTema();
  const { profil, dershane } = useOturum();
  const [not, setNot] = useState<string | null>(null);
  return (
    <Ekran baslik={dershane?.uygulama_ici_ad ?? t("sekmeler.arena")}>
      {profil?.takma_ad && <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("arena.merhaba", { ad: profil.takma_ad })}</Text>}
      {profil?.tur === "ogrenci" && !profil.veli_onayi && (
        <View style={{ padding: 12, borderRadius: BOYUT.yaricap, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
          <Text style={{ color: tema.metin }}>{t("giris.veliOnayiBekleniyor")}</Text>
        </View>
      )}
      {/* Soru çözme döngüsü Faz 1'de bağlanır */}
      <Dugme buyuk baslik={t("arena.soruCoz")} onPress={() => setNot(t("yakinda"))} />
      {not && <Text style={{ color: tema.soluk }}>{not}</Text>}
    </Ekran>
  );
}
