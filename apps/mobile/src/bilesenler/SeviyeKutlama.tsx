import { EVRIM_ADLARI, evrimAsamasi } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, Text, View } from "react-native";
import { Avatar } from "./Avatar";
import { Dugme } from "./Dugme";
import { useTema } from "@/lib/tema";

/** Seviye atlama kutlaması (ölçek + parıltı); 10/25/50'de evrim mesajı. */
export function SeviyeKutlama(p: { seviye: number | null; karakter?: { tur: string; cerceve: string | null; arka_plan: string | null; kostum: string | null } | null; kapat: () => void }) {
  const tema = useTema();
  const olcek = useRef(new Animated.Value(0.3)).current;
  const donus = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (p.seviye === null) return;
    olcek.setValue(0.3);
    donus.setValue(0);
    Animated.parallel([
      Animated.spring(olcek, { toValue: 1, friction: 4, useNativeDriver: true }),
      Animated.timing(donus, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [p.seviye, olcek, donus]);
  if (p.seviye === null) return null;
  const evrim = evrimAsamasi(p.seviye);
  const evrimAni = evrim > evrimAsamasi(p.seviye - 1);
  const aci = donus.interpolate({ inputRange: [0, 1], outputRange: ["-20deg", "0deg"] });
  return (
    <Modal transparent animationType="fade" visible onRequestClose={p.kapat}>
      <Pressable onPress={p.kapat} style={{ flex: 1, backgroundColor: "#000a", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Animated.View style={{ transform: [{ scale: olcek }, { rotate: aci }], alignItems: "center", gap: 14, padding: 28, borderRadius: 20, backgroundColor: tema.yuzey, minWidth: 260 }}>
          <Text style={{ fontSize: 40 }}>🎉</Text>
          {p.karakter && <Avatar tur={p.karakter.tur} seviye={p.seviye} cerceve={p.karakter.cerceve} arkaPlan={p.karakter.arka_plan} kostum={p.karakter.kostum} boyut={96} />}
          <Text style={{ color: tema.vurgu, fontSize: 28, fontWeight: "900" }}>{t("oyun.seviyeAtladin", { n: p.seviye })}</Text>
          {evrimAni && <Text style={{ color: tema.metin, fontSize: 16, fontWeight: "700" }}>{t("oyun.evrim", { ad: EVRIM_ADLARI[evrim] ?? "" })}</Text>}
          <View style={{ alignSelf: "stretch" }}>
            <Dugme baslik={t("ortak.devam")} onPress={p.kapat} />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
