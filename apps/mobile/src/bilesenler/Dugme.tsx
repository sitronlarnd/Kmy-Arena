import { ActivityIndicator, Pressable, Text } from "react-native";
import { BOYUT, useTema } from "@/lib/tema";

export function Dugme(p: { baslik: string; onPress: () => void; yukleniyor?: boolean; ikincil?: boolean; buyuk?: boolean; pasif?: boolean }) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.baslik}
      onPress={p.onPress}
      disabled={p.yukleniyor || p.pasif}
      accessibilityState={{ disabled: Boolean(p.yukleniyor || p.pasif) }}
      style={({ pressed }) => ({
        minHeight: p.buyuk ? 72 : BOYUT.dokunma,
        borderRadius: BOYUT.yaricap,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: p.ikincil ? "transparent" : tema.vurgu,
        opacity: p.pasif ? 0.45 : pressed ? 0.85 : 1,
      })}
    >
      {p.yukleniyor ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={{ color: p.ikincil ? tema.vurgu : "#fff", fontSize: p.buyuk ? 22 : BOYUT.govde, fontWeight: "700" }}>{p.baslik}</Text>
      )}
    </Pressable>
  );
}
