import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import { CheckCircle2, Image as ImageIcon, Lightbulb, MessageCircle, Plus } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Ekran } from "@/bilesenler/Ekran";
import { Basilabilir, Cip, Dugme, Etiket, Kart, Metin } from "@/bilesenler/ui";
import { api } from "@/lib/api";
import { ne_zaman, type AkisSorusu } from "@/lib/topluluk";
import { useMufredat } from "@/lib/sorgular";
import { GRADYAN, OYUN, golge, useTema } from "@/lib/tema";

const FILTRELER = ["hepsi", "acik", "benim", "cevapladiklarim"] as const;

export default function ToplulukAkisi() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const [filtre, setFiltre] = useState<(typeof FILTRELER)[number]>("hepsi");
  const [dersId, setDersId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["topluluk", filtre, dersId],
    queryFn: () => api<AkisSorusu[]>("/api/topluluk/akis", { filtre, dersId }),
    refetchInterval: 30_000,
  });

  return (
    <View style={{ flex: 1, backgroundColor: tema.zemin }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ekran baslik={t("topluluk.baslik")} altBaslik={t("topluluk.aciklama")}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTRELER.map((f) => <Cip key={f} baslik={t(`topluluk.filtre_${f}` as MetinAnahtari)} secili={filtre === f} onPress={() => setFiltre(f)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Cip baslik={t("topluluk.filtre_hepsi")} secili={dersId === null} onPress={() => setDersId(null)} renk={OYUN.elmas} />
          {dersler.map((d) => <Cip key={d.id} baslik={d.ad} secili={dersId === d.id} onPress={() => setDersId(d.id)} renk={OYUN.elmas} />)}
        </ScrollView>
        {q.isSuccess && q.data.length === 0 && (
          <Kart><Metin soluk ortala>{t("topluluk.bos")}</Metin></Kart>
        )}
        {(q.data ?? []).map((s, i) => (
          <Kart key={s.id} sira={Math.min(i, 8)} vurgu={s.durum === "cozuldu" ? tema.dogru : s.benim ? tema.vurgu : undefined} onPress={() => router.push(`/topluluk/${s.id}`)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Etiket metin={s.ders} renk={OYUN.elmas} />
              {s.kazanim_kod && <Etiket metin={s.kazanim_kod} renk={tema.soluk} />}
              <Metin tur="kucuk" soluk stil={{ marginLeft: "auto" }}>{ne_zaman(s.olusturma)}</Metin>
            </View>
            <Metin numberOfLines={3}>{s.metin}</Metin>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Metin tur="kucuk" soluk>{s.benim ? "Sen" : s.soran}</Metin>
              {s.gorselli && <ImageIcon size={14} color={tema.soluk} />}
              {s.ipuclu && <Lightbulb size={14} color={OYUN.altin} />}
              <View style={{ marginLeft: "auto", flexDirection: "row", gap: 6 }}>
                {s.durum === "cozuldu" ? (
                  <Etiket metin={t("topluluk.cozuldu")} renk={tema.dogru} ikon={CheckCircle2} />
                ) : (
                  <Etiket metin={t("topluluk.cevapSayisi", { n: s.cevap_sayisi })} renk={s.cevap_sayisi === 0 ? OYUN.ates : tema.vurgu} ikon={MessageCircle} />
                )}
              </View>
            </View>
          </Kart>
        ))}
        <View style={{ height: 90 }} />
      </Ekran>
      <Animated.View entering={ZoomIn.delay(300).springify()} style={{ position: "absolute", right: 20, bottom: 28 }}>
        <Basilabilir onPress={() => router.push("/topluluk/sor")} etiket={t("topluluk.sor")}>
          <LinearGradient colors={GRADYAN.vurgu} style={{ flexDirection: "row", alignItems: "center", gap: 8, height: 58, paddingHorizontal: 22, borderRadius: 29, ...golge(3, tema.vurgu) }}>
            <Plus size={22} color="#fff" strokeWidth={3} />
            <Metin tur="altbaslik" renk="#fff">{t("topluluk.sor")}</Metin>
          </LinearGradient>
        </Basilabilir>
      </Animated.View>
      {q.isError && <View style={{ position: "absolute", top: 120, left: 20, right: 20 }}><Dugme tur="ikincil" baslik={t("ortak.yenidenDene")} onPress={() => void q.refetch()} /></View>}
    </View>
  );
}
