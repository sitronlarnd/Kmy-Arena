import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Bot, Check, Hourglass, KeyRound, Minus, Swords, Trophy, UserPlus, X as Kapat, Zap } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Alan } from "@/bilesenler/Alan";
import { Ekran } from "@/bilesenler/Ekran";
import { Basilabilir, Bolum, Cip, Dugme, Etiket, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { useOyun } from "@/lib/oyun";
import { useMufredat } from "@/lib/sorgular";
import { GRADYAN, OYUN, useTema } from "@/lib/tema";

interface Gecmis {
  id: string;
  mod: string;
  durum: string;
  skorBen: number;
  skorRakip: number;
  sonuc: "kazandi" | "kaybetti" | "berabere" | null;
  kupa: number;
  davetKodu: string | null;
}

const ROBOT_ONERI_SN = 25;

/** Rakip aranırken dönen radar halkaları */
function Radar() {
  const d = useSharedValue(0);
  useEffect(() => {
    d.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false);
  }, [d]);
  const a1 = useAnimatedStyle(() => ({ opacity: 1 - d.value, transform: [{ scale: 0.4 + d.value * 1.4 }] }));
  const a2 = useAnimatedStyle(() => {
    const v = (d.value + 0.5) % 1;
    return { opacity: 1 - v, transform: [{ scale: 0.4 + v * 1.4 }] };
  });
  return (
    <View style={{ width: 120, height: 120, alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
      {[a1, a2].map((a, i) => (
        <Animated.View key={i} style={[{ position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: "#ffffffaa" }, a]} />
      ))}
      <Swords size={44} color="#fff" />
    </View>
  );
}

export default function DuelloMerkezi() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const oyun = useOyun().data;
  const [dersKodu, setDersKodu] = useState<string | null>(null);
  const [araniyor, setAraniyor] = useState(false);
  const [bekleme, setBekleme] = useState(0);
  const [kod, setKod] = useState("");
  const [takmaAd, setTakmaAd] = useState("");
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setInterval> | null>(null);
  const gecmis = useQuery({ queryKey: ["duello-gecmis"], queryFn: () => api<Gecmis[]>("/api/duello/gecmis", {}) });

  const hataGoster = (h: unknown) => setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
  const dersParam = dersKodu ? { dersKodu } : {};

  const durdur = () => {
    if (zamanlayici.current) clearInterval(zamanlayici.current);
    zamanlayici.current = null;
    setAraniyor(false);
  };
  useEffect(() => () => durdur(), []);

  const dereceli = () => {
    setHata(null);
    setAraniyor(true);
    setBekleme(0);
    const dene = async () => {
      try {
        const y = await api<{ durum: "eslesti"; duelloId: string } | { durum: "bekliyor"; bekleme: number }>("/api/duello/kuyruk", dersParam);
        if (y.durum === "eslesti") {
          durdur();
          router.push(`/duello/${y.duelloId}`);
        } else setBekleme(y.bekleme);
      } catch (h) {
        durdur();
        hataGoster(h);
      }
    };
    void dene();
    zamanlayici.current = setInterval(() => void dene(), 2000);
  };

  const vazgec = () => {
    durdur();
    void api("/api/duello/kuyruktan-cik", {}).catch(() => undefined);
  };

  const calistir = async (anahtar: string, yol: string, govde: unknown) => {
    setMesgul(anahtar);
    setHata(null);
    try {
      if (araniyor) vazgec();
      const y = await api<{ duelloId: string }>(yol, govde);
      router.push(`/duello/${y.duelloId}`);
    } catch (h) {
      hataGoster(h);
    } finally {
      setMesgul(null);
    }
  };

  const modAdi = (m: string) => t(`duello.mod_${m === "arkadas" || m === "robot" || m === "asenkron" ? m : "dereceli"}` as MetinAnahtari);

  return (
    <Ekran baslik={t("duello.baslik")} altBaslik={t("duello.aciklama")}>
      {/* Dereceli: ana sahne */}
      <Kart gradyan={araniyor ? GRADYAN.ates : GRADYAN.vurgu} sira={0}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Metin tur="etiket" renk="#ffffffcc">{t("duello.dereceli")}</Metin>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: "#00000033" }}>
            <Trophy size={16} color={OYUN.altin} fill={`${OYUN.altin}55`} />
            <Metin tur="kucuk" renk="#fff">{oyun?.kupa ?? 0} {t("duello.kupaEtiket")}</Metin>
          </View>
        </View>
        {araniyor ? (
          <Animated.View entering={FadeIn} style={{ gap: 10 }}>
            <Radar />
            <Metin tur="altbaslik" renk="#fff" ortala>{t("duello.araniyor", { sn: bekleme })}</Metin>
            {bekleme >= ROBOT_ONERI_SN && (
              <>
                <Metin renk="#ffffffcc" ortala>{t("duello.robotOner")}</Metin>
                <Dugme tur="altin" ikon={Bot} baslik={t("duello.robot")} yukleniyor={mesgul === "robot"} onPress={() => void calistir("robot", "/api/duello/robot", dersParam)} />
              </>
            )}
            <Basilabilir onPress={vazgec} etiket={t("duello.vazgec")}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44 }}>
                <Kapat size={18} color="#fff" />
                <Metin tur="kucuk" renk="#fff">{t("duello.vazgec")}</Metin>
              </View>
            </Basilabilir>
          </Animated.View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: "#ffffff26", alignItems: "center", justifyContent: "center" }}>
                <Swords size={34} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Metin tur="baslik" renk="#fff">{t("duello.hizliMac")}</Metin>
                <Metin renk="#ffffffcc">{t("duello.derecelAciklama")}</Metin>
              </View>
            </View>
            <Dugme tur="altin" buyuk ikon={Zap} baslik={t("duello.rakipBul")} onPress={dereceli} />
          </>
        )}
      </Kart>

      {dersler.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t("duello.ders")}>
          <Cip baslik={t("duello.sirali")} secili={dersKodu === null} onPress={() => setDersKodu(null)} />
          {dersler.map((d) => <Cip key={d.id} baslik={d.ad} secili={dersKodu === d.kod} onPress={() => setDersKodu(d.kod)} />)}
        </ScrollView>
      )}

      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}

      <Bolum baslik={t("duello.digerModlar")} ikon={Swords} />
      <Kart sira={1}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IkonKutu ikon={UserPlus} renk={OYUN.elmas} />
          <View style={{ flex: 1 }}>
            <Metin tur="altbaslik">{t("duello.davet")}</Metin>
            <Metin tur="kucuk" soluk>{t("duello.davetAciklama")}</Metin>
          </View>
        </View>
        <Dugme tur="ikincil" ikon={UserPlus} baslik={t("duello.davetOlustur")} yukleniyor={mesgul === "davet"} onPress={() => void calistir("davet", "/api/duello/davet", dersParam)} />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}><Alan etiket={t("duello.kodEtiket")} value={kod} onChangeText={(x) => setKod(x.toUpperCase())} autoCapitalize="characters" maxLength={6} /></View>
          <Dugme ikon={KeyRound} baslik={t("duello.katil")} yukleniyor={mesgul === "katil"} pasif={kod.length !== 6} onPress={() => void calistir("katil", "/api/duello/katil", { kod })} />
        </View>
      </Kart>

      <Kart sira={2}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IkonKutu ikon={Hourglass} renk={OYUN.altin} />
          <View style={{ flex: 1 }}>
            <Metin tur="altbaslik">{t("duello.asenkron")}</Metin>
            <Metin tur="kucuk" soluk>{t("duello.asenkronAciklama")}</Metin>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
          <View style={{ flex: 1 }}><Alan etiket={t("duello.takmaAdEtiket")} value={takmaAd} onChangeText={setTakmaAd} autoCapitalize="none" /></View>
          <Dugme baslik={t("duello.gonder")} yukleniyor={mesgul === "asenkron"} pasif={takmaAd.trim().length < 3} onPress={() => void calistir("asenkron", "/api/duello/asenkron", { takmaAd, ...dersParam })} />
        </View>
      </Kart>

      <Kart sira={3} onPress={() => void calistir("robot", "/api/duello/robot", dersParam)}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IkonKutu ikon={Bot} renk={OYUN.buz} />
          <View style={{ flex: 1 }}>
            <Metin tur="altbaslik">{t("duello.robot")}</Metin>
            <Metin tur="kucuk" soluk>{t("duello.robotAciklama")}</Metin>
          </View>
          <Zap size={20} color={tema.soluk} />
        </View>
      </Kart>

      {(gecmis.data ?? []).length > 0 && (
        <>
          <Bolum baslik={t("duello.gecmis")} ikon={Trophy} />
          <Kart sira={4}>
            {(gecmis.data ?? []).map((g) => {
              const renk = g.sonuc === "kazandi" ? tema.dogru : g.sonuc === "kaybetti" ? tema.yanlis : g.durum === "bitti" ? tema.soluk : OYUN.altin;
              const Ikon = g.sonuc === "kazandi" ? Check : g.sonuc === "kaybetti" ? Kapat : g.durum === "bitti" ? Minus : Hourglass;
              return (
                <Basilabilir key={g.id} onPress={() => router.push(`/duello/${g.id}`)} etiket={modAdi(g.mod)}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: `${renk}26` }}>
                      <Ikon size={16} color={renk} strokeWidth={3} />
                    </View>
                    <Metin stil={{ flex: 1 }}>{modAdi(g.mod)}</Metin>
                    <Metin tur="altbaslik">{g.skorBen}–{g.skorRakip}</Metin>
                    {g.kupa !== 0 && <Etiket metin={`${g.kupa > 0 ? "+" : ""}${g.kupa}`} renk={g.kupa > 0 ? tema.dogru : tema.yanlis} ikon={Trophy} />}
                  </View>
                </Basilabilir>
              );
            })}
          </Kart>
        </>
      )}
    </Ekran>
  );
}
