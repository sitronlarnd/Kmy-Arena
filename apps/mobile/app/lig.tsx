import { LIG_KADEMELERI, ligAdimi } from "@kmy/shared";
import { ChevronDown, ChevronUp, Crown, Trophy } from "lucide-react-native";
import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ekran } from "@/bilesenler/Ekran";
import { Avatar } from "@/bilesenler/sanat";
import { Cip, Kart, Metin } from "@/bilesenler/ui";
import { useOyun } from "@/lib/oyun";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { GRADYAN, OYUN, golge, useTema } from "@/lib/tema";

interface Satir {
  sira: number;
  takma_ad: string;
  karakter: string | null;
  cerceve: string | null;
  ben: boolean;
}

type Kapsam = "lig" | "sinif" | "sube" | "dershane" | "dershaneler";

/** Haftalık lig grubu ve sıralamalar. Yalnızca takma ad ve karakter görünür. */
export default function Lig() {
  const tema = useTema();
  const id = useOturum((s) => s.oturum?.user.id);
  const dershaneArasi = useOturum((s) => s.ozellikler.dershaneler_arasi_lig === true);
  const oyun = useOyun().data;
  const [kapsam, setKapsam] = useState<Kapsam>("lig");
  const [donem, setDonem] = useState<"hafta" | "tum">("hafta");
  const lig = ligAdimi(oyun?.ligAdim ?? 1);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["siralama", id, kapsam, donem],
    enabled: Boolean(id),
    queryFn: async (): Promise<Array<Satir & { puan: number; dershane?: string | null }>> => {
      if (kapsam === "lig") {
        const { data: d, error: h } = await supabase.rpc("lig_grubum");
        if (h) throw h;
        return ((d ?? []) as Array<Satir & { xp: number }>).map((r) => ({ ...r, puan: r.xp }));
      }
      const { data: d, error: h } = await supabase.rpc("siralama", { p_kapsam: kapsam, p_donem: donem });
      if (h) throw h;
      return (d ?? []) as Array<Satir & { puan: number; dershane: string | null }>;
    },
  });
  const n = data.length;

  const podyum = data.slice(0, 3);
  const PODYUM_SIRA = [1, 0, 2];
  const yukseklik = [110, 80, 60];
  const renk: Array<readonly [string, string]> = [GRADYAN.altin, ["#E6ECF5", "#8E9AAF"], ["#E0A26B", "#A0602C"]];

  return (
    <Ekran baslik={t("oyun.lig")}>
      <Stack.Screen options={{ headerShown: false }} />
      <Kart gradyan={[`${lig.renk}55`, "#141631"]} sira={0}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Trophy size={44} color={lig.renk} fill={`${lig.renk}55`} />
          <View style={{ flex: 1 }}>
            <Metin tur="baslik" renk="#fff">{lig.ad}</Metin>
            <Metin renk="#ffffffcc">{t("oyun.ligHafta", { xp: oyun?.haftalikXp ?? 0 })}</Metin>
          </View>
        </View>
        <Metin tur="kucuk" renk="#ffffffaa">{t("oyun.ligAciklama")}</Metin>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center" }}>
          {LIG_KADEMELERI.map((k, i) => (
            <View key={k.ad} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: i + 1 === lig.kademe ? k.renk : "#ffffff14" }}>
              <Metin tur="kucuk" renk={i + 1 === lig.kademe ? "#141631" : "#ffffffaa"} stil={{ fontSize: 11 }}>{k.ad}</Metin>
            </View>
          ))}
        </ScrollView>
      </Kart>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
        <Cip baslik={t("oyun.lig")} secili={kapsam === "lig"} onPress={() => setKapsam("lig")} />
        <Cip baslik={t("oyun.sinif")} secili={kapsam === "sinif"} onPress={() => setKapsam("sinif")} />
        <Cip baslik={t("oyun.sube")} secili={kapsam === "sube"} onPress={() => setKapsam("sube")} />
        <Cip baslik={t("oyun.dershane")} secili={kapsam === "dershane"} onPress={() => setKapsam("dershane")} />
        {dershaneArasi && <Cip baslik={t("oyun.dershaneler")} secili={kapsam === "dershaneler"} onPress={() => setKapsam("dershaneler")} />}
      </ScrollView>
      {kapsam !== "lig" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Cip baslik={t("oyun.buHafta")} secili={donem === "hafta"} onPress={() => setDonem("hafta")} renk={OYUN.elmas} />
          <Cip baslik={t("oyun.tumZamanlar")} secili={donem === "tum"} onPress={() => setDonem("tum")} renk={OYUN.elmas} />
        </View>
      )}

      {kapsam === "lig" && !isLoading && n === 0 && <Metin soluk>{t("oyun.ligBos")}</Metin>}
      {error && <Metin renk={tema.yanlis}>{t("ortak.hata")}</Metin>}

      {/* Podyum: ilk üç */}
      {podyum.length >= 3 && (
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10, paddingTop: 20 }}>
          {PODYUM_SIRA.map((i) => {
            const r = podyum[i];
            if (!r) return null;
            const g = renk[i] ?? GRADYAN.vurgu;
            return (
              <Animated.View key={r.takma_ad} entering={FadeInUp.delay(200 + i * 150).springify()} style={{ alignItems: "center", width: 100, gap: 6 }}>
                {i === 0 && <Crown size={26} color={OYUN.altin} fill={OYUN.altin} />}
                <Avatar tur={r.karakter} cerceve={r.cerceve} boyut={i === 0 ? 68 : 56} aura={false} />
                <Metin tur="kucuk" ortala numberOfLines={1}>{r.takma_ad}</Metin>
                <LinearGradient colors={g} style={{ width: "100%", height: yukseklik[i], borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: "center", paddingTop: 8, ...golge(2, g[1]) }}>
                  <Metin tur="baslik" renk="#fff">{i + 1}</Metin>
                  <Metin tur="kucuk" renk="#ffffffdd">{r.puan} XP</Metin>
                </LinearGradient>
              </Animated.View>
            );
          })}
        </View>
      )}

      <Kart sira={2}>
        {data.map((r, idx) => {
          const yukselen = kapsam === "lig" && r.sira <= (n >= 10 ? 5 : Math.max(1, Math.floor(n / 3))) && r.puan > 0;
          const dusen = kapsam === "lig" && n >= 10 && r.sira > n - 5;
          return (
            <Animated.View
              key={`${r.sira}-${r.takma_ad}`}
              entering={FadeInDown.delay(Math.min(idx, 15) * 30)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 14, backgroundColor: r.ben ? `${tema.vurgu}26` : yukselen ? `${tema.dogru}0F` : dusen ? `${tema.yanlis}0F` : "transparent" }}
            >
              <Metin tur="altbaslik" renk={yukselen ? tema.dogru : dusen ? tema.yanlis : tema.soluk} stil={{ width: 28, fontSize: 15 }}>{r.sira}</Metin>
              <Avatar tur={r.karakter} cerceve={r.cerceve} boyut={36} aura={false} />
              <View style={{ flex: 1 }}>
                <Metin tur={r.ben ? "altbaslik" : "govde"} stil={{ fontSize: 15 }}>{r.takma_ad}{r.ben ? ` (${t("oyun.sen")})` : ""}</Metin>
                {r.dershane && <Metin tur="kucuk" soluk>{r.dershane}</Metin>}
              </View>
              {yukselen && <ChevronUp size={18} color={tema.dogru} />}
              {dusen && <ChevronDown size={18} color={tema.yanlis} />}
              <Metin tur="kucuk">{r.puan} XP</Metin>
            </Animated.View>
          );
        })}
      </Kart>
    </Ekran>
  );
}
