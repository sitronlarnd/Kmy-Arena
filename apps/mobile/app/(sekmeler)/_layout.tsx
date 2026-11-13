import { t } from "@kmy/shared/i18n";
import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useOturum } from "@/lib/oturum";
import { useTema } from "@/lib/tema";

const simge = (s: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 20 }}>{s}</Text>;

export default function SekmeDuzeni() {
  const tema = useTema();
  const ozellikler = useOturum((s) => s.ozellikler);
  // Özellik bayrağı kapalıysa sekme gizlenir (Merkez Panelden dershane bazında)
  const acik = (kod: string) => ozellikler[kod] !== false;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tema.vurgu,
        tabBarInactiveTintColor: tema.soluk,
        tabBarStyle: { backgroundColor: tema.yuzey, borderTopColor: tema.kenar, minHeight: 56 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("sekmeler.arena"), tabBarIcon: simge("⚔") }} />
      <Tabs.Screen name="harita" options={{ title: t("sekmeler.harita"), tabBarIcon: simge("◈") }} />
      <Tabs.Screen name="duello" options={{ title: t("sekmeler.duello"), tabBarIcon: simge("⚡"), href: acik("duello") ? undefined : null }} />
      <Tabs.Screen name="klan" options={{ title: t("sekmeler.klan"), tabBarIcon: simge("⛨"), href: acik("klan_savasi") ? undefined : null }} />
      <Tabs.Screen name="profil" options={{ title: t("sekmeler.profil"), tabBarIcon: simge("●") }} />
    </Tabs>
  );
}
