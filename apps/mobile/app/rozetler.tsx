import { ROZETLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Stack } from "expo-router";
import { Coins } from "lucide-react-native";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Ekran } from "@/bilesenler/Ekran";
import { RozetMadalya } from "@/bilesenler/sanat";
import { Cubuk, Etiket, Metin } from "@/bilesenler/ui";
import { useOyun } from "@/lib/oyun";
import { OYUN, useTema } from "@/lib/tema";

export default function Rozetler() {
  const tema = useTema();
  const sahip = new Set(useOyun().data?.rozetler ?? []);
  const sirali = [...ROZETLER].sort((a, b) => Number(sahip.has(b.kod)) - Number(sahip.has(a.kod)));
  return (
    <Ekran baslik={t("oyun.rozetler")} altBaslik={`${sahip.size} / ${ROZETLER.length}`}>
      <Stack.Screen options={{ headerShown: false }} />
      <Cubuk oran={sahip.size / ROZETLER.length} gradyan={["#C4A1FF", "#7C5CFA"]} parilti />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
        {sirali.map((r, i) => {
          const var_ = sahip.has(r.kod);
          return (
            <Animated.View
              key={r.kod}
              entering={ZoomIn.delay(Math.min(i, 20) * 30).springify()}
              accessibilityLabel={`${r.ad}: ${r.aciklama}`}
              style={{ width: "30%", minWidth: 100, flexGrow: 1, padding: 12, gap: 6, alignItems: "center", borderRadius: 20, borderWidth: 1, borderColor: var_ ? `${OYUN.xp}66` : tema.kenar, backgroundColor: tema.yuzey }}
            >
              <RozetMadalya kod={r.kod} kategori={r.kategori} boyut={64} kilitli={!var_} />
              <Metin tur="kucuk" ortala numberOfLines={1}>{r.ad}</Metin>
              <Metin tur="kucuk" soluk ortala numberOfLines={2} stil={{ fontSize: 11 }}>{r.aciklama}</Metin>
              {r.faz ? <Etiket metin={t("oyun.yakinda")} renk={tema.soluk} /> : <Etiket metin={`+${r.altin}`} renk={OYUN.altinKoyu} ikon={Coins} />}
            </Animated.View>
          );
        })}
      </View>
    </Ekran>
  );
}
