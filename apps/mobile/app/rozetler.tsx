import { ROZETLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Stack } from "expo-router";
import { Text, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { useOyun } from "@/lib/oyun";
import { useTema } from "@/lib/tema";

export default function Rozetler() {
  const tema = useTema();
  const sahip = new Set(useOyun().data?.rozetler ?? []);
  const sirali = [...ROZETLER].sort((a, b) => Number(sahip.has(b.kod)) - Number(sahip.has(a.kod)));
  return (
    <Ekran baslik={`${t("oyun.rozetler")} (${sahip.size}/${ROZETLER.length})`}>
      <Stack.Screen options={{ headerShown: true, title: t("oyun.rozetler"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {sirali.map((r) => {
          const var_ = sahip.has(r.kod);
          return (
            <View
              key={r.kod}
              accessibilityLabel={`${r.ad}: ${r.aciklama}`}
              style={{ width: 160, padding: 12, gap: 4, borderRadius: 12, borderWidth: 1, borderColor: var_ ? tema.vurgu : tema.kenar, backgroundColor: tema.yuzey, opacity: var_ ? 1 : 0.55 }}
            >
              <Text style={{ fontSize: 30 }}>{var_ ? r.emoji : "🔒"}</Text>
              <Text style={{ color: tema.metin, fontWeight: "700" }}>{r.ad}</Text>
              <Text style={{ color: tema.soluk, fontSize: 12 }}>{r.aciklama}</Text>
              <Text style={{ color: tema.soluk, fontSize: 11 }}>
                {r.faz ? t("oyun.yakinda") : `+${r.altin} Altın${r.unvan ? ` · ${t("oyun.unvan")}: ${r.unvan}` : ""}`}
              </Text>
            </View>
          );
        })}
      </View>
    </Ekran>
  );
}
