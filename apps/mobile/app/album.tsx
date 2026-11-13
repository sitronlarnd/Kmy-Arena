import type { Ustalik } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Stack } from "expo-router";
import { Text, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useBeceriler, useMufredat } from "@/lib/sorgular";
import { useTema } from "@/lib/tema";

const RENK: Record<Ustalik, string> = { kesfedilmedi: "transparent", bronz: "#B87333", gumus: "#8E9AAF", altin: "#D4A017" };

/** Kazanım kart albümü: Bronz/Gümüş/Altın olan kazanımın kartı albüme girer. Kartın tek kaynağı soru çözmek. */
export default function Album() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const beceri = useBeceriler().data ?? new Map();
  return (
    <Ekran baslik={t("oyun.album")}>
      <Stack.Screen options={{ headerShown: true, title: t("oyun.album"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <Text style={{ color: tema.soluk }}>{t("oyun.albumAciklama")}</Text>
      {dersler.map((d) => {
        const kazanimlar = d.uniteler.flatMap((u) => u.kazanimlar);
        const toplanan = kazanimlar.filter((k) => (beceri.get(k.id)?.ustalik ?? "kesfedilmedi") !== "kesfedilmedi").length;
        return (
          <Kart key={d.id}>
            <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 16 }}>
              {d.ad} · {d.sinav_turu} — {toplanan}/{kazanimlar.length}{toplanan === kazanimlar.length && kazanimlar.length > 0 ? " 🃏" : ""}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {kazanimlar.map((k) => {
                const u: Ustalik = beceri.get(k.id)?.ustalik ?? "kesfedilmedi";
                const var_ = u !== "kesfedilmedi";
                return (
                  <View
                    key={k.id}
                    accessibilityLabel={`${k.kod} ${t(`harita.ustalik.${u}`)}`}
                    style={{ width: 54, height: 72, borderRadius: 8, borderWidth: 2, borderColor: var_ ? RENK[u] : tema.kenar, backgroundColor: var_ ? `${RENK[u]}33` : tema.zemin, alignItems: "center", justifyContent: "center", padding: 2 }}
                  >
                    <Text style={{ fontSize: 9, color: var_ ? tema.metin : tema.soluk, textAlign: "center" }} numberOfLines={3}>{var_ ? k.kod : "?"}</Text>
                  </View>
                );
              })}
            </View>
          </Kart>
        );
      })}
    </Ekran>
  );
}
