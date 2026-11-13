import type { Sik } from "@kmy/shared";
import { Check, X } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring } from "react-native-reanimated";
import { MatematikMetni } from "./MatematikMetni";
import { Metin } from "./ui";
import { BOYUT, golge, useTema } from "@/lib/tema";

/** Şık kartı: seçimde yaylanır; sonuçta doğru şık yeşil parlar ve zıplar, yanlış seçim kızarır. */
export function SikKarti(p: { harf: Sik; sira: number; md: string; secili: boolean; durum: "dogru" | "yanlis" | "soluk" | null; pasif: boolean; onPress: () => void }) {
  const tema = useTema();
  const s = useSharedValue(1);
  useEffect(() => {
    if (p.durum === "dogru") s.value = withSequence(withSpring(1.05, { damping: 6 }), withSpring(1));
  }, [p.durum, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const renk = p.durum === "dogru" ? tema.dogru : p.durum === "yanlis" ? tema.yanlis : p.secili ? tema.vurgu : tema.kenar;
  const dolu = p.durum === "dogru" || p.durum === "yanlis" || p.secili;
  return (
    <Animated.View entering={FadeInDown.delay(80 + p.sira * 60).springify().damping(16)} style={[a, { opacity: p.durum === "soluk" ? 0.5 : 1 }]}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: p.secili, disabled: p.pasif }}
        accessibilityLabel={`${p.harf} şıkkı`}
        disabled={p.pasif}
        onPressIn={() => { s.value = withSpring(0.97); }}
        onPressOut={() => { s.value = withSpring(1); }}
        onPress={p.onPress}
        style={{ flexDirection: "row", gap: 12, alignItems: "center", minHeight: 60, padding: 12, borderRadius: 18, borderWidth: 2, borderColor: renk, backgroundColor: dolu ? `${renk}1F` : tema.yuzey, ...(p.secili || p.durum === "dogru" ? golge(2, renk) : {}) }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: dolu ? renk : tema.yuzey2, borderWidth: dolu ? 0 : 1, borderColor: tema.kenar }}>
          {p.durum === "dogru" ? <Check size={20} color="#fff" strokeWidth={3} /> : p.durum === "yanlis" ? <X size={20} color="#fff" strokeWidth={3} /> : (
            <Metin tur="altbaslik" renk={dolu ? "#fff" : tema.metin} stil={{ fontSize: 16 }}>{p.harf}</Metin>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <MatematikMetni md={p.md} renk={tema.metin} boyut={BOYUT.govde} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
