import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { Link } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Alan } from "@/bilesenler/Alan";
import { LinearGradient } from "expo-linear-gradient";
import { Ticket, UserPlus } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Dugme, IkonKutu, Metin } from "@/bilesenler/ui";
import { hataAnahtari, useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

/**
 * Davet koduyla katılım: (1) hesap yoksa e-posta + şifreyle hesap açılır,
 * (2) davet_kodu_kullan() ile dershaneye, role ve sınıfa bağlanılır.
 * Veli onayı gerekiyorsa sosyal özellikler kapalı kalır (sunucu belirler).
 */
export default function Katil() {
  const tema = useTema();
  const { oturum, yukle } = useOturum();
  const [kod, setKod] = useState("");
  const [eposta, setEposta] = useState("");
  const [sifre, setSifre] = useState("");
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [takmaAd, setTakmaAd] = useState("");
  const [dogumYili, setDogumYili] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  async function katil() {
    setBekliyor(true);
    setHata(null);
    try {
      let aktif = oturum;
      if (!aktif) {
        const { data, error } = await supabase.auth.signUp({ email: eposta.trim(), password: sifre });
        if (error || !data.session) throw new Error("ortak.hata");
        aktif = data.session;
      }
      const { error } = await supabase.rpc("davet_kodu_kullan", {
        p_kod: kod,
        p_ad: ad,
        p_soyad: soyad,
        p_takma_ad: takmaAd || null,
        p_dogum_yili: dogumYili ? Number(dogumYili) : null,
      });
      if (error) throw new Error(error.message);
      await yukle(aktif);
    } catch (h) {
      const anahtar = hataAnahtari(h instanceof Error ? h.message : undefined);
      setHata(t((anahtar ?? "ortak.hata") as MetinAnahtari));
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.zemin }}>
    <LinearGradient colors={["#3B2A8F", "#141631", tema.zemin]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 420 }} />
    <ScrollView contentContainerStyle={{ padding: 24, gap: BOYUT.bosluk, maxWidth: 480, width: "100%", alignSelf: "center" }}>
      <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: "center", gap: 8, paddingTop: 20 }}>
        <IkonKutu ikon={Ticket} renk="#FFC53D" boyut={72} />
        <Metin tur="baslik" ortala>{t("giris.baslik")}</Metin>
      </Animated.View>
      <Alan etiket={t("giris.davetKoduEtiket")} placeholder={t("giris.davetKoduIpucu")} value={kod} onChangeText={(v) => setKod(v.toUpperCase())} autoCapitalize="characters" maxLength={8} />
      {!oturum && (
        <>
          <Alan etiket={t("giris.epostaEtiket")} value={eposta} onChangeText={setEposta} autoCapitalize="none" keyboardType="email-address" />
          <Alan etiket={t("giris.sifreEtiket")} value={sifre} onChangeText={setSifre} secureTextEntry autoComplete="new-password" />
        </>
      )}
      <Alan etiket={t("giris.adEtiket")} value={ad} onChangeText={setAd} />
      <Alan etiket={t("giris.soyadEtiket")} value={soyad} onChangeText={setSoyad} />
      <Alan etiket={t("giris.takmaAdEtiket")} placeholder={t("giris.takmaAdIpucu")} value={takmaAd} onChangeText={setTakmaAd} autoCapitalize="none" />
      <Alan etiket={t("giris.dogumYiliEtiket")} value={dogumYili} onChangeText={setDogumYili} keyboardType="number-pad" maxLength={4} />
      <Metin tur="kucuk" soluk>{t("giris.kvkkOnay")}</Metin>
      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
      <Dugme buyuk ikon={UserPlus} baslik={t("giris.katil")} onPress={katil} yukleniyor={bekliyor} />
      {!oturum && (
        <Link href="/(auth)/giris" style={{ color: tema.vurgu, textAlign: "center", padding: 12 }}>
          {t("giris.hesabinVarMi")}
        </Link>
      )}
    </ScrollView>
    </View>
  );
}
