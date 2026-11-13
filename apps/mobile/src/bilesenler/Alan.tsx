import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { Metin } from "./ui";
import { BOYUT, useTema, yazi } from "@/lib/tema";

/** Metin alanı: odakta vurgu rengiyle parlayan kenar. */
export function Alan({ etiket, ...p }: TextInputProps & { etiket: string }) {
  const tema = useTema();
  const [odak, setOdak] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Metin tur="kucuk" soluk>{etiket}</Metin>
      <TextInput
        accessibilityLabel={etiket}
        placeholderTextColor={tema.soluk}
        {...p}
        onFocus={(e) => { setOdak(true); p.onFocus?.(e); }}
        onBlur={(e) => { setOdak(false); p.onBlur?.(e); }}
        style={[yazi("kalin"), { minHeight: BOYUT.dokunma + 4, borderWidth: 2, borderColor: odak ? tema.vurgu : tema.kenar, borderRadius: 16, paddingHorizontal: 16, color: tema.metin, backgroundColor: tema.yuzey2, fontSize: BOYUT.govde }]}
      />
    </View>
  );
}
