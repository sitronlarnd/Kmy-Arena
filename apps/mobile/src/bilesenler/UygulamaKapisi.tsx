import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { Download, Wrench } from "lucide-react-native";
import type { ReactNode } from "react";
import { Linking, Platform, View } from "react-native";
import { MarkaLogo } from "./sanat";
import { Dugme, Metin } from "./ui";
import { supabase } from "@/lib/supabase";
import { useTema } from "@/lib/tema";

interface Ayar { min_surum: string; bakim_modu: boolean; bakim_mesaji: string | null; duyuru: string | null }

/** "1.2.10" > "1.2.9" karşılaştırması */
export function surumKucuk(a: string, b: string): boolean {
  const x = a.split(".").map(Number), y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) { const p = x[i] ?? 0, q = y[i] ?? 0; if (p !== q) return p < q; }
  return false;
}

const MAGAZA = process.env.EXPO_PUBLIC_MAGAZA_URL ?? (Platform.OS === "ios" ? "https://apps.apple.com/tr/search?term=KMY%20Arena" : "https://play.google.com/store/apps/details?id=cloud.kmyai.arena");

/** Merkezden yönetilen bakım modu, zorunlu güncelleme ve uygulama içi duyuru. */
export function UygulamaKapisi({ children }: { children: ReactNode }) {
  const tema = useTema();
  const { data } = useQuery({
    queryKey: ["uygulama_ayari"],
    queryFn: async () => (await supabase.from("uygulama_ayari").select("min_surum, bakim_modu, bakim_mesaji, duyuru").maybeSingle<Ayar>()).data,
    refetchInterval: 300_000,
  });
  const surum = Constants.expoConfig?.version ?? "0.0.0";
  const ekran = (ikon: ReactNode, baslik: string, metin: string, dugme?: ReactNode) => (
    <View style={{ flex: 1, backgroundColor: tema.zemin, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <MarkaLogo boyut={72} />
      {ikon}
      <Metin tur="baslik" ortala>{baslik}</Metin>
      <Metin soluk ortala>{metin}</Metin>
      {dugme}
    </View>
  );
  if (data?.bakim_modu) return ekran(<Wrench size={32} color={tema.vurgu} />, t("kapi.bakim"), data.bakim_mesaji ?? t("kapi.bakimMetni"));
  if (data && Platform.OS !== "web" && surumKucuk(surum, data.min_surum)) {
    return ekran(<Download size={32} color={tema.vurgu} />, t("kapi.guncelle"), t("kapi.guncelleMetni"), <Dugme genis={false} baslik={t("kapi.guncelleDugme")} onPress={() => void Linking.openURL(MAGAZA)} />);
  }
  return (
    <View style={{ flex: 1 }}>
      {data?.duyuru ? (
        <View style={{ backgroundColor: tema.vurgu, paddingHorizontal: 16, paddingVertical: 8, paddingTop: Platform.OS === "ios" ? 50 : 8 }}>
          <Metin tur="kucuk" renk="#fff" ortala>{data.duyuru}</Metin>
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
