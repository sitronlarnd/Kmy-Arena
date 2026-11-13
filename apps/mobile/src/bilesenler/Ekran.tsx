import { t } from "@kmy/shared/i18n";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Metin } from "./ui";
import { BOYUT, useTema } from "@/lib/tema";

/** Ekran iskeleti: üstte vurgu renginden zemine akan hafif degrade hâle, büyük başlık. */
export function Ekran({ baslik, altBaslik, sag, children, baslikGizli }: { baslik: string; altBaslik?: string; sag?: ReactNode; children?: ReactNode; baslikGizli?: boolean }) {
  const tema = useTema();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }}>
      <LinearGradient
        pointerEvents="none"
        colors={[`${tema.vurgu}${tema.koyu ? "40" : "26"}`, `${tema.vurgu}00`]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 320 }}
      />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: BOYUT.bosluk, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {!baslikGizli && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Metin tur="baslik" accessibilityRole="header">{baslik}</Metin>
              {altBaslik && <Metin tur="kucuk" soluk>{altBaslik}</Metin>}
            </View>
            {sag}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Yakinda() {
  return <Metin soluk>{t("yakinda")}</Metin>;
}
