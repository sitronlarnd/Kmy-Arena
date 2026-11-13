import { hazirMesaj, KLAN_HAZIR_MESAJLAR, type Sik } from "@kmy/shared";
import { Flag } from "lucide-react-native";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Kart } from "@/bilesenler/Kart";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { api, ApiHatasi } from "@/lib/api";
import { useOturum } from "@/lib/oturum";
import { BOYUT, useTema } from "@/lib/tema";

interface Mesaj {
  id: number;
  tur: "hazir" | "soru" | "serbest" | "sistem";
  kod: string | null;
  metin: string | null;
  benim: boolean;
  takma_ad: string | null;
  soru: { id: string; govde_md: string; siklar: Partial<Record<Sik, string>> } | null;
}

export default function KlanSohbet() {
  const tema = useTema();
  const serbest = useOturum((s) => s.ozellikler.klan_sohbeti_serbest === true);
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([]);
  const [metin, setMetin] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const sonId = useRef(0);
  const kaydir = useRef<ScrollView>(null);

  const yenile = useCallback(async () => {
    try {
      const y = await api<Mesaj[]>("/api/klan/mesajlar", { sonra: sonId.current });
      if (y.length > 0) {
        sonId.current = Math.max(sonId.current, ...y.map((m) => m.id));
        setMesajlar((o) => [...o, ...y.filter((m) => !o.some((x) => x.id === m.id))].slice(-200));
        setTimeout(() => kaydir.current?.scrollToEnd({ animated: true }), 50);
      }
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  }, []);

  useEffect(() => {
    void yenile();
    const i = setInterval(() => void yenile(), 5000);
    return () => clearInterval(i);
  }, [yenile]);

  const gonder = async (govde: Record<string, unknown>) => {
    setHata(null);
    setBilgi(null);
    try {
      await api("/api/klan/mesaj", govde);
      setMetin("");
      await yenile();
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  };

  const sikayet = async (id: number) => {
    try {
      await api("/api/klan/sikayet", { hedefTur: "klan_mesaj", hedefId: id, sebep: "uygunsuz" });
      setBilgi(t("klan.sikayetEdildi"));
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  };

  const icerik = (m: Mesaj): string => {
    if (m.tur === "sistem") return t(`klan.sistem_${m.kod ?? "kuruldu"}` as MetinAnahtari, { ad: m.takma_ad ?? "", metin: m.metin ?? "" });
    if (m.tur === "hazir") return hazirMesaj(m.kod) ?? "";
    if (m.tur === "soru") return t("klan.takildim");
    return m.metin ?? "";
  };

  return (
    <View style={{ flex: 1, backgroundColor: tema.zemin }}>
      <Stack.Screen options={{ headerShown: true, title: t("klan.sohbet"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <ScrollView ref={kaydir} contentContainerStyle={{ padding: BOYUT.bosluk, gap: 8 }}>
        {mesajlar.length === 0 && <Text style={{ color: tema.soluk }}>{t("klan.sohbetBos")}</Text>}
        {mesajlar.map((m) =>
          m.tur === "sistem" ? (
            <Text key={m.id} style={{ color: tema.soluk, textAlign: "center", fontSize: 13 }}>— {icerik(m)} —</Text>
          ) : (
            <View key={m.id} style={{ alignSelf: m.benim ? "flex-end" : "flex-start", maxWidth: "85%" }}>
              {!m.benim && <Text style={{ color: tema.soluk, fontSize: 12 }}>{m.takma_ad}</Text>}
              <Kart stil={{ backgroundColor: m.benim ? tema.vurgu : tema.yuzey }}>
                <Text style={{ color: m.benim ? "#fff" : tema.metin }}>{icerik(m)}</Text>
                {m.soru && <MatematikMetni md={m.soru.govde_md} renk={m.benim ? "#fff" : tema.metin} boyut={BOYUT.govde} />}
              </Kart>
              {!m.benim && (
                <Pressable onPress={() => void sikayet(m.id)} accessibilityRole="button">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Flag size={11} color={tema.soluk} /><Text style={{ color: tema.soluk, fontSize: 11 }}>{t("klan.sikayet")}</Text></View>
                </Pressable>
              )}
            </View>
          ),
        )}
      </ScrollView>
      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: tema.kenar, backgroundColor: tema.yuzey }}>
        {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
        {bilgi && <Text style={{ color: tema.dogru }}>{bilgi}</Text>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {KLAN_HAZIR_MESAJLAR.map((h) => (
            <Pressable key={h.kod} onPress={() => void gonder({ tur: "hazir", kod: h.kod })}
              style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: tema.kenar, backgroundColor: tema.zemin }}>
              <Text style={{ color: tema.metin }}>{h.metin}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {serbest && (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TextInput value={metin} onChangeText={setMetin} maxLength={300} placeholder={t("klan.serbestYaz")} placeholderTextColor={tema.soluk}
              accessibilityLabel={t("klan.serbestYaz")}
              style={{ flex: 1, minHeight: BOYUT.dokunma, borderWidth: 1, borderColor: tema.kenar, borderRadius: 10, paddingHorizontal: 12, color: tema.metin }} />
            <Pressable onPress={() => metin.trim() && void gonder({ tur: "serbest", metin })} accessibilityRole="button"
              style={{ minHeight: BOYUT.dokunma, paddingHorizontal: 16, justifyContent: "center", borderRadius: 10, backgroundColor: tema.vurgu }}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>{t("klan.gonder")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
