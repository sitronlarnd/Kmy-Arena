import type { Sik } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { BookOpenCheck, HeartHandshake, Repeat, Send, Sparkles, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import Animated, { FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { Basilabilir, Dugme, Etiket, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { BOYUT, GRADYAN, OYUN, golge, useTema, yazi } from "@/lib/tema";

interface Mesaj { id: number; rol: "ogrenci" | "asistan"; icerik: string; destek: boolean }
interface Durum {
  oturumId: string;
  tur?: "soru" | "fotograf";
  fotograf?: { metinMd: string; siklar: Partial<Record<Sik, string>>; dersKodu: string | null; kazanimKodu: string | null } | null;
  mesajlar: Mesaj[];
  kalan: number;
}

function YaziyorNoktalari() {
  const tema = useTema();
  const v = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  useEffect(() => {
    v.forEach((x, i) => { x.value = withDelay(i * 150, withRepeat(withSequence(withTiming(-5, { duration: 280 }), withTiming(0, { duration: 280 })), -1)); });
  }, []);
  const s0 = useAnimatedStyle(() => ({ transform: [{ translateY: v[0]?.value ?? 0 }] }));
  const s1 = useAnimatedStyle(() => ({ transform: [{ translateY: v[1]?.value ?? 0 }] }));
  const s2 = useAnimatedStyle(() => ({ transform: [{ translateY: v[2]?.value ?? 0 }] }));
  return (
    <View style={{ flexDirection: "row", gap: 5, padding: 14, alignSelf: "flex-start", borderRadius: 18, backgroundColor: tema.yuzey }}>
      {[s0, s1, s2].map((s, i) => <Animated.View key={i} style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: tema.vurgu }, s]} />)}
    </View>
  );
}

export default function Asistan() {
  const tema = useTema();
  const p = useLocalSearchParams<{ soruId?: string; oturumId?: string }>();
  const [d, setD] = useState<Durum | null>(null);
  const [metin, setMetin] = useState("");
  const [yaziyor, setYaziyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [cozum, setCozum] = useState<{ dogru: Sik | null; adimlar: string[] } | null>(null);
  const kaydir = useRef<ScrollView>(null);

  const hataGoster = (h: unknown) => setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));

  useEffect(() => {
    const yukle = async () => {
      try {
        const y = p.oturumId
          ? await api<Durum>("/api/asistan/oturum", { oturumId: p.oturumId })
          : await api<Durum>("/api/asistan/soru", { soruId: p.soruId });
        setD(y);
      } catch (h) {
        hataGoster(h);
      }
    };
    void yukle();
  }, [p.oturumId, p.soruId]);

  useEffect(() => {
    setTimeout(() => kaydir.current?.scrollToEnd({ animated: true }), 80);
  }, [d?.mesajlar.length, yaziyor, cozum]);

  const gonder = async (icerik: string) => {
    if (!d || !icerik.trim() || yaziyor) return;
    setHata(null);
    const gecici: Mesaj = { id: -Date.now(), rol: "ogrenci", icerik: icerik.trim(), destek: false };
    setD({ ...d, mesajlar: [...d.mesajlar, gecici] });
    setMetin("");
    setYaziyor(true);
    try {
      const y = await api<{ yanit: Mesaj; kalan: number }>("/api/asistan/mesaj", { oturumId: d.oturumId, metin: icerik });
      setD((o) => (o ? { ...o, mesajlar: [...o.mesajlar, y.yanit], kalan: y.kalan } : o));
    } catch (h) {
      hataGoster(h);
    } finally {
      setYaziyor(false);
    }
  };

  const tamCozum = async () => {
    if (!d) return;
    try {
      setCozum(await api<{ dogru: Sik | null; adimlar: string[] }>("/api/asistan/cozum", { oturumId: d.oturumId }));
    } catch (h) {
      hataGoster(h);
    }
  };

  const hizli = [t("asistan.hizli1"), t("asistan.hizli2"), t("asistan.hizli3")];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient pointerEvents="none" colors={[`${OYUN.elmas}30`, `${OYUN.elmas}00`]} style={{ position: "absolute", left: 0, right: 0, top: 0, height: 240 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <Basilabilir onPress={() => router.back()} etiket={t("soru.kapat")}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
            <X size={20} color={tema.metin} />
          </View>
        </Basilabilir>
        <IkonKutu ikon={Sparkles} renk={OYUN.elmas} boyut={40} />
        <View style={{ flex: 1 }}>
          <Metin tur="altbaslik">{t("asistan.baslik")}</Metin>
          <Metin tur="kucuk" soluk>{d ? t("asistan.kalan", { n: Math.max(0, d.kalan) }) : t("ortak.yukleniyor")}</Metin>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={kaydir} contentContainerStyle={{ padding: 16, gap: 10, maxWidth: 760, width: "100%", alignSelf: "center" }}>
          {d?.fotograf && (
            <Kart vurgu={OYUN.elmas}>
              <Etiket metin={t("fotograf.okunanSoru")} renk={OYUN.elmas} />
              <MatematikMetni md={d.fotograf.metinMd} renk={tema.metin} boyut={BOYUT.govde} />
              {(Object.entries(d.fotograf.siklar) as Array<[Sik, string]>).map(([h, m]) => (
                <View key={h} style={{ flexDirection: "row", gap: 8 }}>
                  <Metin tur="kucuk" renk={tema.vurgu}>{h})</Metin>
                  <View style={{ flex: 1 }}><MatematikMetni md={m} renk={tema.metin} boyut={BOYUT.govde} /></View>
                </View>
              ))}
              {d.fotograf.kazanimKodu && <Etiket metin={d.fotograf.kazanimKodu} renk={tema.soluk} />}
            </Kart>
          )}

          <Animated.View entering={FadeInDown.springify()} style={{ alignSelf: "flex-start", maxWidth: "88%", padding: 14, borderRadius: 18, borderTopLeftRadius: 6, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
            <Metin>{t("asistan.karsilama")}</Metin>
          </Animated.View>

          {d?.mesajlar.map((m) =>
            m.rol === "ogrenci" ? (
              <Animated.View key={m.id} entering={FadeInUp.springify().damping(16)} style={{ alignSelf: "flex-end", maxWidth: "85%", borderRadius: 18, borderTopRightRadius: 6, overflow: "hidden", ...golge(1, tema.vurgu) }}>
                <LinearGradient colors={tema.vurguGradyan} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14 }}>
                  <Metin renk="#fff">{m.icerik}</Metin>
                </LinearGradient>
              </Animated.View>
            ) : (
              <Animated.View key={m.id} entering={FadeInDown.springify().damping(16)} style={{ alignSelf: "flex-start", maxWidth: "88%", padding: 14, gap: 6, borderRadius: 18, borderTopLeftRadius: 6, backgroundColor: m.destek ? `${OYUN.ates}1F` : tema.yuzey, borderWidth: 1, borderColor: m.destek ? `${OYUN.ates}66` : tema.kenar }}>
                {m.destek && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <HeartHandshake size={18} color={OYUN.ates} />
                    <Metin tur="kucuk" renk={OYUN.ates}>{t("asistan.destek")}</Metin>
                  </View>
                )}
                <MatematikMetni md={m.icerik} renk={tema.metin} boyut={BOYUT.govde} />
              </Animated.View>
            ),
          )}
          {yaziyor && <YaziyorNoktalari />}

          {cozum && (
            <Kart vurgu={tema.dogru}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <BookOpenCheck size={20} color={tema.dogru} />
                <Metin tur="altbaslik" stil={{ flex: 1 }}>{t("soru.cozum")}</Metin>
                {cozum.dogru && <Etiket metin={t("duello.dogruCevap", { sik: cozum.dogru })} renk={tema.dogru} />}
              </View>
              {cozum.adimlar.length === 0 && <Metin soluk>{t("asistan.cozumYok")}</Metin>}
              {cozum.adimlar.map((a, i) => (
                <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${tema.dogru}26` }}>
                    <Metin tur="kucuk" renk={tema.dogru}>{i + 1}</Metin>
                  </View>
                  <View style={{ flex: 1 }}><MatematikMetni md={a} renk={tema.metin} boyut={BOYUT.govde} /></View>
                </View>
              ))}
            </Kart>
          )}
          {d?.fotograf?.kazanimKodu && (
            <Dugme tur="dogru" ikon={Repeat} baslik={t("fotograf.benzerCoz")} onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: d.fotograf?.kazanimKodu ?? "", baslik: t("fotograf.benzerBaslik") } })} />
          )}
          {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
        </ScrollView>

        <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderColor: tema.kenar, backgroundColor: tema.yuzey }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {!cozum && (
              <Basilabilir onPress={() => void tamCozum()} etiket={t("asistan.tamCozum")}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: `${tema.dogru}22` }}>
                  <BookOpenCheck size={15} color={tema.dogru} />
                  <Metin tur="kucuk" renk={tema.dogru}>{t("asistan.tamCozum")}</Metin>
                </View>
              </Basilabilir>
            )}
            {hizli.map((h) => (
              <Basilabilir key={h} onPress={() => void gonder(h)} etiket={h} pasif={yaziyor}>
                <View style={{ minHeight: 38, justifyContent: "center", paddingHorizontal: 12, borderRadius: 19, borderWidth: 1, borderColor: tema.kenar, backgroundColor: tema.zemin }}>
                  <Metin tur="kucuk">{h}</Metin>
                </View>
              </Basilabilir>
            ))}
          </ScrollView>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end", maxWidth: 760, width: "100%", alignSelf: "center" }}>
            <TextInput
              value={metin}
              onChangeText={setMetin}
              maxLength={600}
              multiline
              placeholder={t("asistan.yaz")}
              placeholderTextColor={tema.soluk}
              accessibilityLabel={t("asistan.yaz")}
              style={[yazi("kalin"), { flex: 1, minHeight: BOYUT.dokunma, maxHeight: 120, borderWidth: 2, borderColor: tema.kenar, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, color: tema.metin, backgroundColor: tema.yuzey2, fontSize: 15 }]}
            />
            <Basilabilir onPress={() => void gonder(metin)} pasif={!metin.trim() || yaziyor || !d} etiket={t("asistan.gonder")}>
              <LinearGradient colors={GRADYAN.vurgu} style={{ width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", opacity: !metin.trim() || yaziyor ? 0.5 : 1 }}>
                <Send size={20} color="#fff" />
              </LinearGradient>
            </Basilabilir>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
