import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { router, Stack } from "expo-router";
import { Camera, ImageUp, ScanLine, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Image, Platform, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Ekran } from "@/bilesenler/Ekran";
import { Dugme, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { gorselSec } from "@/lib/gorsel";
import { OYUN, golge, useTema } from "@/lib/tema";

/** Taranırken fotoğraf üzerinde gidip gelen tarama çizgisi */
function TaramaCizgisi() {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [y]);
  const a = useAnimatedStyle(() => ({ top: `${y.value * 96}%` }));
  return <Animated.View style={[{ position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: OYUN.elmas, ...golge(2, OYUN.elmas) }, a]} />;
}

export default function FotografCoz() {
  const tema = useTema();
  const [gorsel, setGorsel] = useState<string | null>(null);
  const [taraniyor, setTaraniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const sec = async (kaynak: "kamera" | "galeri") => {
    setHata(null);
    const g = await gorselSec(kaynak);
    if (!g) return;
    setGorsel(g.uri);
    setTaraniyor(true);
    try {
      const y = await api<{ oturumId: string }>("/api/asistan/fotograf", { gorsel: g.base64 });
      router.replace({ pathname: "/asistan", params: { oturumId: y.oturumId } });
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    } finally {
      setTaraniyor(false);
    }
  };

  return (
    <Ekran baslik={t("fotograf.baslik")} altBaslik={t("fotograf.aciklama")}>
      <Stack.Screen options={{ headerShown: false }} />
      {gorsel ? (
        <Animated.View entering={FadeIn} style={{ borderRadius: 24, overflow: "hidden", borderWidth: 2, borderColor: taraniyor ? OYUN.elmas : tema.kenar }}>
          <Image source={{ uri: gorsel }} style={{ width: "100%", aspectRatio: 3 / 4 }} resizeMode="cover" accessibilityLabel={t("fotograf.secilen")} />
          {taraniyor && <TaramaCizgisi />}
        </Animated.View>
      ) : (
        <Kart sira={0}>
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 16 }}>
            <IkonKutu ikon={ScanLine} renk={OYUN.elmas} boyut={84} />
            <Metin tur="altbaslik" ortala>{t("fotograf.nasil")}</Metin>
            <Metin soluk ortala>{t("fotograf.ipucu")}</Metin>
          </View>
        </Kart>
      )}
      {taraniyor && <Metin ortala renk={OYUN.elmas}>{t("fotograf.taraniyor")}</Metin>}
      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
      {!taraniyor && (
        <>
          {Platform.OS !== "web" && <Dugme buyuk ikon={Camera} baslik={t("fotograf.cek")} onPress={() => void sec("kamera")} />}
          <Dugme tur={Platform.OS === "web" ? "ana" : "ikincil"} buyuk={Platform.OS === "web"} ikon={ImageUp} baslik={t("fotograf.galeri")} onPress={() => void sec("galeri")} />
        </>
      )}
      <Kart sira={1} vurgu={tema.dogru}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <ShieldCheck size={20} color={tema.dogru} />
          <Metin tur="kucuk" soluk stil={{ flex: 1 }}>{t("fotograf.gizlilik")}</Metin>
        </View>
      </Kart>
    </Ekran>
  );
}
