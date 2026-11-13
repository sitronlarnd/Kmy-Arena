import { t } from "@kmy/shared/i18n";
import { Tabs } from "expo-router";
import { Map, Shield, Swords, UserRound, Zap, type LucideIcon } from "lucide-react-native";
import { useEffect } from "react";
import { View, type ColorValue } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useOturum } from "@/lib/oturum";
import { golge, useTema, yazi } from "@/lib/tema";

function SekmeIkonu({ Ikon, odak, renk }: { Ikon: LucideIcon; odak: boolean; renk: string }) {
  const tema = useTema();
  const s = useSharedValue(odak ? 1 : 0);
  useEffect(() => {
    s.value = withSpring(odak ? 1 : 0, { damping: 12, stiffness: 220 });
  }, [odak, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 + s.value * 0.12 }, { translateY: -s.value * 2 }] }));
  const zemin = useAnimatedStyle(() => ({ opacity: s.value, transform: [{ scaleX: 0.6 + s.value * 0.4 }] }));
  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: 56, height: 32 }}>
      <Animated.View style={[{ position: "absolute", width: 52, height: 30, borderRadius: 15, backgroundColor: `${tema.vurgu}2E` }, zemin]} />
      <Animated.View style={a}>
        <Ikon size={22} color={renk} strokeWidth={odak ? 2.6 : 2} />
      </Animated.View>
    </View>
  );
}

const ikon = (Ikon: LucideIcon) => ({ color, focused }: { color: ColorValue; focused: boolean }) => <SekmeIkonu Ikon={Ikon} odak={focused} renk={String(color)} />;

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
        tabBarLabelStyle: { ...yazi("ekstra"), fontSize: 11 },
        tabBarStyle: { backgroundColor: tema.yuzey, borderTopColor: tema.kenar, height: 68, paddingTop: 6, paddingBottom: 8, ...golge(3, "#000") },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("sekmeler.arena"), tabBarIcon: ikon(Swords) }} />
      <Tabs.Screen name="harita" options={{ title: t("sekmeler.harita"), tabBarIcon: ikon(Map) }} />
      <Tabs.Screen name="duello" options={{ title: t("sekmeler.duello"), tabBarIcon: ikon(Zap), href: acik("duello") ? undefined : null }} />
      <Tabs.Screen name="klan" options={{ title: t("sekmeler.klan"), tabBarIcon: ikon(Shield), href: acik("klan_savasi") ? undefined : null }} />
      <Tabs.Screen name="profil" options={{ title: t("sekmeler.profil"), tabBarIcon: ikon(UserRound) }} />
    </Tabs>
  );
}
