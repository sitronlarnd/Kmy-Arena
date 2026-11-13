import { t } from "@kmy/shared/i18n";
import { Link } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { Alan } from "@/bilesenler/Alan";
import { Dugme } from "@/bilesenler/Dugme";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <View style={{ gap: BOYUT.bosluk, maxWidth: 420, width: "100%", alignSelf: "center" }}>
        <Text style={{ fontSize: 32, fontWeight: "800", color: tema.metin }}>{t("uygulama.ad")}</Text>
        <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("uygulama.slogan")}</Text>
        <Alan etiket={t("giris.epostaEtiket")} value={eposta} onChangeText={setEposta} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Alan etiket={t("giris.sifreEtiket")} value={sifre} onChangeText={setSifre} secureTextEntry autoComplete="current-password" />
        {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
        <Dugme baslik={t("giris.girisYap")} onPress={girisYap} yukleniyor={bekliyor} />
        <Link href="/(auth)/katil" style={{ color: tema.vurgu, textAlign: "center", padding: 12 }}>
          {t("giris.hesabinYokMu")}
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
