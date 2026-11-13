import { Platform, useColorScheme, type TextStyle, type ViewStyle } from "react-native";
import { useOturum } from "./oturum";

/**
 * KMY Arena görsel dili: koyu, derin lacivert zemin üzerinde canlı mor→mavi
 * vurgu; oyun ekonomisi için sabit "oyun renkleri" (XP mor, Altın, Kupa, seri
 * ateşi, buz). Açık tema yumuşak lavanta zeminlidir. Dershane ana rengi
 * vurgunun ilk durağını değiştirir (white-label).
 */
const ACIK = {
  zemin: "#F3F2FB",
  zemin2: "#E9E7FA",
  yuzey: "#FFFFFF",
  yuzey2: "#F7F6FF",
  metin: "#17142B",
  soluk: "#6A6788",
  kenar: "#E2DFF3",
  dogru: "#14B866",
  yanlis: "#F0435A",
  golge: "#5B4BD6",
};
const KOYU = {
  zemin: "#0B0C1A",
  zemin2: "#141631",
  yuzey: "#171933",
  yuzey2: "#1F2244",
  metin: "#F4F3FF",
  soluk: "#9C9BC2",
  kenar: "#2A2D52",
  dogru: "#2EE08A",
  yanlis: "#FF5C72",
  golge: "#000000",
};

/** Oyun ekonomisi renkleri (tema bağımsız) */
export const OYUN = {
  xp: "#8B6CFF",
  altin: "#FFC53D",
  altinKoyu: "#E89B00",
  kupa: "#FF9F1C",
  ates: "#FF6A3D",
  buz: "#5CC8FF",
  elmas: "#4DE3D2",
  boss: "#FF4D6D",
} as const;

export const GRADYAN = {
  vurgu: ["#8B5CF6", "#5B7CFF"] as const,
  ates: ["#FF8A3D", "#FF3D6E"] as const,
  altin: ["#FFD861", "#FF9F1C"] as const,
  dogru: ["#3CF0A0", "#12B76A"] as const,
  yanlis: ["#FF7A8A", "#E5354F"] as const,
  buz: ["#7DDBFF", "#4C7DFF"] as const,
  gece: ["#1B1E45", "#0B0C1A"] as const,
  boss: ["#FF5C7A", "#8B2CF5"] as const,
} as const;

export const BOYUT = { dokunma: 48, soruMetni: 18, govde: 16, baslik: 28, yaricap: 20, bosluk: 16 } as const;

/** Nunito ağırlıkları (native'de her ağırlık ayrı aile adıdır) */
export const YAZI = {
  normal: "Nunito_600SemiBold",
  kalin: "Nunito_700Bold",
  ekstra: "Nunito_800ExtraBold",
  siyah: "Nunito_900Black",
} as const;

export function yazi(agirlik: "normal" | "kalin" | "ekstra" | "siyah" = "normal"): TextStyle {
  // Web'de Nunito değişken yazı tipi + fontWeight; native'de ağırlığa özel aile
  if (Platform.OS === "web") {
    return { fontFamily: "Nunito, system-ui, sans-serif", fontWeight: ({ normal: "600", kalin: "700", ekstra: "800", siyah: "900" } as const)[agirlik] };
  }
  return { fontFamily: YAZI[agirlik] };
}

export function golge(seviye: 1 | 2 | 3 = 1, renk = "#000"): ViewStyle {
  const y = [0, 4, 10, 18][seviye] ?? 4;
  const r = [0, 10, 20, 32][seviye] ?? 10;
  const o = [0, 0.18, 0.28, 0.4][seviye] ?? 0.2;
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${y}px ${r}px ${renk}${Math.round(o * 255).toString(16).padStart(2, "0")}` } as ViewStyle,
    default: { shadowColor: renk, shadowOffset: { width: 0, height: y }, shadowOpacity: o, shadowRadius: r / 2, elevation: seviye * 4 },
  }) as ViewStyle;
}

export function useTema() {
  const koyu = useColorScheme() !== "light";
  const vurgu = useOturum((s) => s.dershane?.ana_renk) ?? "#7C5CFA";
  const r = koyu ? KOYU : ACIK;
  return { ...r, vurgu, vurguGradyan: [vurgu, GRADYAN.vurgu[1]] as const, koyu };
}
export type Tema = ReturnType<typeof useTema>;
