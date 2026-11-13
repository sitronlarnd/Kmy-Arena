import { useColorScheme } from "react-native";
import { useOturum } from "./oturum";

/** Tasarım token'ları. Dershane ana rengi vurgu rengini değiştirir. */
const ACIK = { zemin: "#F6F7FB", yuzey: "#FFFFFF", metin: "#1B1D29", soluk: "#6B6F80", kenar: "#E4E6EF", dogru: "#1E8E5A", yanlis: "#C62828" };
const KOYU = { zemin: "#11121A", yuzey: "#1B1D29", metin: "#F1F2F6", soluk: "#A0A3B5", kenar: "#2B2E3D", dogru: "#3FBF7F", yanlis: "#EF5350" };

export const BOYUT = { dokunma: 44, soruMetni: 17, govde: 16, baslik: 24, yaricap: 12, bosluk: 16 } as const;

export function useTema() {
  const koyu = useColorScheme() === "dark";
  const vurgu = useOturum((s) => s.dershane?.ana_renk) ?? "#5B5BF0";
  return { ...(koyu ? KOYU : ACIK), vurgu, koyu };
}
