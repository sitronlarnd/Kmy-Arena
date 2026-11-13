import { KARAKTERLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Check } from "lucide-react-native";
import { View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Ekran } from "@/bilesenler/Ekran";
import { Avatar } from "@/bilesenler/sanat";
import { Basilabilir, Dugme, Metin } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { useOyun, useOyunYenile } from "@/lib/oyun";
import { golge, useTema } from "@/lib/tema";

export default function KarakterSec() {
  const tema = useTema();
  const oyun = useOyun().data;
  const yenile = useOyunYenile();
  const [secili, setSecili] = useState<string | null>(oyun?.karakter?.tur ?? null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const kaydet = async () => {
    if (!secili) return;
    setYukleniyor(true);
    try {
      await api("/api/oyun/karakter", { tur: secili });
      yenile();
      router.back();
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as "ortak.hata"));
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <Ekran baslik={t("oyun.karakterSec")} altBaslik={t("oyun.karakterAciklama")}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
        {KARAKTERLER.map((k, i) => {
          const aktif = secili === k.tur;
          return (
            <Animated.View key={k.tur} entering={ZoomIn.delay(i * 60).springify()} style={{ width: "47%", flexGrow: 1 }}>
              <Basilabilir onPress={() => setSecili(k.tur)} secili={aktif} etiket={k.ad}>
                <View style={{ padding: 14, gap: 6, alignItems: "center", borderRadius: 24, borderWidth: 2, borderColor: aktif ? k.renk : tema.kenar, backgroundColor: aktif ? `${k.renk}22` : tema.yuzey, ...(aktif ? golge(2, k.renk) : {}) }}>
                  <Avatar tur={k.tur} boyut={92} />
                  <Metin tur="altbaslik" ortala>{k.ad}</Metin>
                  <Metin tur="kucuk" soluk ortala>{k.aciklama}</Metin>
                  {aktif && (
                    <View style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: k.renk, alignItems: "center", justifyContent: "center" }}>
                      <Check size={16} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </View>
              </Basilabilir>
            </Animated.View>
          );
        })}
      </View>
      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
      <Dugme buyuk ikon={Check} baslik={t("oyun.sec")} onPress={() => void kaydet()} yukleniyor={yukleniyor} pasif={!secili} />
    </Ekran>
  );
}
