import type { Ustalik } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { Stack } from "expo-router";
import { Crown, HelpCircle, Medal, Star } from "lucide-react-native";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Ekran } from "@/bilesenler/Ekran";
import { Cubuk, Etiket, Kart, Metin } from "@/bilesenler/ui";
import { useBeceriler, useMufredat } from "@/lib/sorgular";
import { GRADYAN, OYUN, useTema } from "@/lib/tema";

const KART: Record<Exclude<Ustalik, "kesfedilmedi">, { renk: readonly [string, string]; ikon: typeof Star }> = {
  bronz: { renk: ["#E0A26B", "#8A4B1C"], ikon: Medal },
  gumus: { renk: ["#E6ECF5", "#6D7A93"], ikon: Star },
  altin: { renk: ["#FFE07A", "#C77B00"], ikon: Crown },
};

/** Kazanım kart albümü: Bronz/Gümüş/Altın olan kazanımın kartı albüme girer. Kartın tek kaynağı soru çözmek. */
export default function Album() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const beceri = useBeceriler().data ?? new Map();
  return (
    <Ekran baslik={t("oyun.album")} altBaslik={t("oyun.albumAciklama")}>
      <Stack.Screen options={{ headerShown: false }} />
      {dersler.map((d, di) => {
        const kazanimlar = d.uniteler.flatMap((u) => u.kazanimlar);
        const toplanan = kazanimlar.filter((k) => (beceri.get(k.id)?.ustalik ?? "kesfedilmedi") !== "kesfedilmedi").length;
        const tam = toplanan === kazanimlar.length && kazanimlar.length > 0;
        return (
          <Kart key={d.id} sira={di} vurgu={tam ? OYUN.altin : undefined}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Metin tur="altbaslik" stil={{ flex: 1 }}>{d.ad}</Metin>
              {tam && <Etiket metin={t("oyun.tamSet")} renk={OYUN.altin} ikon={Crown} />}
              <Metin tur="kucuk" soluk>{toplanan}/{kazanimlar.length}</Metin>
            </View>
            <Cubuk oran={toplanan / Math.max(1, kazanimlar.length)} gradyan={GRADYAN.altin} yukseklik={8} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {kazanimlar.map((k, i) => {
                const u: Ustalik = beceri.get(k.id)?.ustalik ?? "kesfedilmedi";
                if (u === "kesfedilmedi") {
                  return (
                    <View key={k.id} accessibilityLabel={`${k.kod} ${t("harita.ustalik.kesfedilmedi")}`}
                      style={{ width: 58, height: 80, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: tema.kenar, alignItems: "center", justifyContent: "center" }}>
                      <HelpCircle size={18} color={tema.kenar} />
                    </View>
                  );
                }
                const x = KART[u];
                return (
                  <Animated.View key={k.id} entering={ZoomIn.delay(Math.min(i, 20) * 25).springify()} accessibilityLabel={`${k.kod} ${t(`harita.ustalik.${u}`)}`}>
                    <LinearGradient colors={x.renk} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 58, height: 80, borderRadius: 10, alignItems: "center", justifyContent: "center", gap: 4, padding: 3, borderWidth: 1.5, borderColor: "#ffffff66" }}>
                      <x.ikon size={20} color="#fff" fill="#ffffff44" />
                      <Metin tur="kucuk" renk="#fff" ortala numberOfLines={2} stil={{ fontSize: 8, lineHeight: 10 }}>{k.kod}</Metin>
                    </LinearGradient>
                  </Animated.View>
                );
              })}
            </View>
          </Kart>
        );
      })}
    </Ekran>
  );
}
