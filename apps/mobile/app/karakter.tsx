import { KARAKTERLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Avatar } from "@/bilesenler/Avatar";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { api, ApiHatasi } from "@/lib/api";
import { useOyun, useOyunYenile } from "@/lib/oyun";
import { BOYUT, useTema } from "@/lib/tema";

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
    <Ekran baslik={t("oyun.karakterSec")}>
      <Stack.Screen options={{ headerShown: true, title: t("oyun.karakterSec"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("oyun.karakterAciklama")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {KARAKTERLER.map((k) => {
          const aktif = secili === k.tur;
          return (
            <Pressable
              key={k.tur}
              accessibilityRole="radio"
              accessibilityState={{ selected: aktif }}
              onPress={() => setSecili(k.tur)}
              style={{ width: 150, padding: 12, gap: 6, alignItems: "center", borderRadius: BOYUT.yaricap, borderWidth: 2, borderColor: aktif ? k.renk : tema.kenar, backgroundColor: tema.yuzey }}
            >
              <Avatar tur={k.tur} boyut={64} />
              <Text style={{ color: tema.metin, fontWeight: "700" }}>{k.ad}</Text>
              <Text style={{ color: tema.soluk, fontSize: 12, textAlign: "center" }}>{k.aciklama}</Text>
            </Pressable>
          );
        })}
      </View>
      {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
      <Dugme baslik={t("oyun.sec")} onPress={() => void kaydet()} yukleniyor={yukleniyor} pasif={!secili} />
    </Ekran>
  );
}
