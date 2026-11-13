import { KARAKTERLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { LogIn } from "lucide-react-native";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import Animated, { Easing, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Alan } from "@/bilesenler/Alan";
import { Avatar } from "@/bilesenler/sanat";
import { Dugme, Metin } from "@/bilesenler/ui";
import { supabase } from "@/lib/supabase";
import { golge, useTema } from "@/lib/tema";

/** Süzülen karakter (giriş ekranı sahnesi) */
function Suzulen({ tur, gecikme, boyut }: { tur: string; gecikme: number; boyut: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(gecikme, withRepeat(withSequence(withTiming(-10, { duration: 1600, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) })), -1));
  }, [y, gecikme]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={a}><Avatar tur={tur} boyut={boyut} aura={false} /></Animated.View>;
}

export default function Giris() {
  const tema = useTema();
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function girisYap() {
    setBekliyor(true);
    setHata(null);
    const { error } = await supabase.auth.signInWithPassword({ email: eposta.trim(), password: sifre });
    setBekliyor(false);
    if (error) setHata(t("ortak.hata"));
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.zemin }}>
      <LinearGradient colors={["#3B2A8F", "#141631", tema.zemin]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 520 }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 20, maxWidth: 440, width: "100%", alignSelf: "center" }}>
          <Animated.View entering={FadeInDown.duration(600)} style={{ flexDirection: "row", justifyContent: "center", alignItems: "flex-end", gap: 6, height: 110 }}>
            {KARAKTERLER.slice(0, 5).map((k, i) => (
              <Suzulen key={k.tur} tur={k.tur} gecikme={i * 220} boyut={i === 2 ? 84 : i === 1 || i === 3 ? 64 : 50} />
            ))}
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(600)} style={{ alignItems: "center", gap: 6 }}>
            <Metin tur="dev" ortala stil={{ fontSize: 40, lineHeight: 46 }}>{t("uygulama.ad")}</Metin>
            <Metin soluk ortala>{t("uygulama.slogan")}</Metin>
          </Animated.View>
          <Animated.View entering={FadeInUp.delay(300).springify().damping(16)} style={{ gap: 14, padding: 20, borderRadius: 28, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar, ...golge(3, "#000") }}>
            <Alan etiket={t("giris.epostaEtiket")} value={eposta} onChangeText={setEposta} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Alan etiket={t("giris.sifreEtiket")} value={sifre} onChangeText={setSifre} secureTextEntry autoComplete="current-password" onSubmitEditing={() => void girisYap()} />
            {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
            <Dugme buyuk ikon={LogIn} baslik={t("giris.girisYap")} onPress={() => void girisYap()} yukleniyor={bekliyor} />
          </Animated.View>
          <Link href="/(auth)/katil" style={{ color: tema.vurgu, textAlign: "center", padding: 12, fontWeight: "800", fontSize: 15 }}>
            {t("giris.hesabinYokMu")}
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
