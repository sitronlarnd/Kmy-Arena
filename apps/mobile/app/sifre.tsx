import { t } from "@kmy/shared/i18n";
import { KeyRound, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Alan } from "@/bilesenler/Alan";
import { MarkaLogo } from "@/bilesenler/sanat";
import { Dugme, Kart, Metin } from "@/bilesenler/ui";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { useTema } from "@/lib/tema";

const SITE = process.env.EXPO_PUBLIC_SITE_URL;

/** Panelden açılan hesapta ilk giriş: kendi şifresini belirleme ve KVKK aydınlatmasını onaylama. */
export default function SifreBelirle() {
  const tema = useTema();
  const { profil, oturum, yukle } = useOturum();
  const [sifre, setSifre] = useState("");
  const [tekrar, setTekrar] = useState("");
  const [onay, setOnay] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);
  const sifreGerekli = profil?.sifre_degismeli ?? false;

  async function kaydet() {
    setHata(null);
    if (sifreGerekli && (sifre.length < 8 || sifre !== tekrar)) { setHata(t("sifre.kurallar")); return; }
    if (!profil?.kvkk_onay_tarihi && !onay) { setHata(t("sifre.onayGerekli")); return; }
    setBekliyor(true);
    try {
      if (sifreGerekli) {
        const { error } = await supabase.auth.updateUser({ password: sifre });
        if (error) throw error;
        await supabase.rpc("sifre_degisti");
      }
      if (!profil?.kvkk_onay_tarihi) await supabase.rpc("kvkk_onayla");
      await yukle(oturum);
    } catch {
      setHata(t("ortak.hata"));
    } finally {
      setBekliyor(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: tema.zemin }} contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 18, maxWidth: 440, width: "100%", alignSelf: "center" }}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <MarkaLogo boyut={64} />
        <Metin tur="baslik" ortala>{t("sifre.baslik")}</Metin>
        <Metin soluk ortala>{t("sifre.aciklama")}</Metin>
      </View>
      <Kart>
        <View style={{ gap: 14 }}>
          {sifreGerekli && (
            <>
              <Alan etiket={t("sifre.yeni")} value={sifre} onChangeText={setSifre} secureTextEntry autoComplete="new-password" />
              <Alan etiket={t("sifre.tekrar")} value={tekrar} onChangeText={setTekrar} secureTextEntry autoComplete="new-password" />
              <Metin tur="kucuk" soluk>{t("sifre.kurallar")}</Metin>
            </>
          )}
          {!profil?.kvkk_onay_tarihi && (
            <Pressable onPress={() => setOnay((x) => !x)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }} accessibilityRole="checkbox" accessibilityState={{ checked: onay }}>
              <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: onay ? tema.vurgu : tema.kenar, backgroundColor: onay ? tema.vurgu : "transparent", alignItems: "center", justifyContent: "center" }}>
                {onay ? <ShieldCheck size={15} color="#fff" /> : null}
              </View>
              <Metin tur="kucuk" stil={{ flex: 1 }}>
                {t("sifre.kvkk")}{SITE ? <> <Metin tur="kucuk" stil={{ color: tema.vurgu }} onPress={() => void Linking.openURL(`${SITE}/gizlilik`)}>{t("sifre.metniOku")}</Metin></> : null}
              </Metin>
            </Pressable>
          )}
          {hata && <Metin tur="kucuk" stil={{ color: tema.yanlis }}>{hata}</Metin>}
          <Dugme ikon={KeyRound} baslik={bekliyor ? t("ortak.yukleniyor") : t("sifre.kaydet")} onPress={() => void kaydet()} />
          <Dugme tur="hayalet" baslik={t("giris.cikisYap")} onPress={() => void supabase.auth.signOut()} />
        </View>
      </Kart>
    </ScrollView>
  );
}
