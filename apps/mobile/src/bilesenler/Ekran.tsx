import { t } from "@kmy/shared/i18n";
import type { ReactNode } from "react";
import { ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BOYUT, useTema } from "@/lib/tema";

export function Ekran({ baslik, children }: { baslik: string; children?: ReactNode }) {
  const tema = useTema();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: BOYUT.bosluk, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        <Text accessibilityRole="header" style={{ fontSize: BOYUT.baslik, fontWeight: "800", color: tema.metin }}>{baslik}</Text>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Yakinda() {
  const tema = useTema();
  return <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("yakinda")}</Text>;
}
