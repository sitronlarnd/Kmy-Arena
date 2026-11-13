import { Text, TextInput, View, type TextInputProps } from "react-native";
import { BOYUT, useTema } from "@/lib/tema";

export function Alan({ etiket, ...p }: TextInputProps & { etiket: string }) {
  const tema = useTema();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: tema.soluk, fontSize: 14 }}>{etiket}</Text>
      <TextInput
        accessibilityLabel={etiket}
        placeholderTextColor={tema.soluk}
        {...p}
        style={{ minHeight: BOYUT.dokunma, borderWidth: 1, borderColor: tema.kenar, borderRadius: 10, paddingHorizontal: 12, color: tema.metin, backgroundColor: tema.yuzey, fontSize: BOYUT.govde }}
      />
    </View>
  );
}
