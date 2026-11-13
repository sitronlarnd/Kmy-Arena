import type { ReactNode } from "react";
import { View, type ViewStyle } from "react-native";
import { BOYUT, useTema } from "@/lib/tema";

export function Kart({ children, stil }: { children: ReactNode; stil?: ViewStyle }) {
  const tema = useTema();
  return (
    <View style={[{ padding: 16, borderRadius: BOYUT.yaricap, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar, gap: 8 }, stil]}>
      {children}
    </View>
  );
}
