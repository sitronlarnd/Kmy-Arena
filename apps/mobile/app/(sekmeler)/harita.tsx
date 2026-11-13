import type { Ustalik } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { router } from "expo-router";
import { Crown, Lock, Medal, Play, Star, X } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown, SlideInDown, ZoomIn } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { Ekran } from "@/bilesenler/Ekran";
import { Basilabilir, Cip, Cubuk, Dugme, Etiket, Kart, Metin } from "@/bilesenler/ui";
import { useBeceriler, useMufredat } from "@/lib/sorgular";
import { golge, useTema } from "@/lib/tema";

const USTALIK: Record<Ustalik, { renk: [string, string]; ikon: typeof Star }> = {
  kesfedilmedi: { renk: ["#3A3D66", "#262948"], ikon: Lock },
  bronz: { renk: ["#E0A26B", "#A0602C"], ikon: Medal },
  gumus: { renk: ["#D9E2F2", "#8E9AAF"], ikon: Star },
  altin: { renk: ["#FFE07A", "#E89B00"], ikon: Crown },
};
const GENISLIK = 320;
const ADIM = 96;
const KONUM = [0.5, 0.78, 0.5, 0.22];

/** Konu haritası: her ünite bir yol; kazanımlar ustalığa göre parlayan duraklar. */
export default function Harita() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const beceri = useBeceriler().data ?? new Map();
  const [dersId, setDersId] = useState<string | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const ders = dersler.find((d) => d.id === dersId) ?? dersler[0];
  const kodlar = new Map(dersler.flatMap((d) => d.uniteler.flatMap((u) => u.kazanimlar.map((k) => [k.id, k.kod] as const))));
  const tum = ders?.uniteler.flatMap((u) => u.kazanimlar) ?? [];
  const ustaSayisi = tum.filter((k) => (beceri.get(k.id)?.ustalik ?? "kesfedilmedi") !== "kesfedilmedi").length;
  const sKaz = tum.find((k) => k.id === secili);
  const sBec = sKaz ? beceri.get(sKaz.id) : undefined;
  const sUst: Ustalik = sBec?.ustalik ?? "kesfedilmedi";
  const eksik = sKaz?.on_kosullar.find((o) => !beceri.get(o) || beceri.get(o)?.ustalik === "kesfedilmedi");

  return (
    <View style={{ flex: 1, backgroundColor: tema.zemin }}>
      <Ekran baslik={t("sekmeler.harita")} altBaslik={t("harita.aciklama")}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dersler.map((d) => <Cip key={d.id} baslik={d.ad} secili={ders?.id === d.id} onPress={() => { setDersId(d.id); setSecili(null); }} />)}
        </ScrollView>
        {ders && (
          <Kart sira={0}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Metin tur="altbaslik">{ders.ad}</Metin>
              <Metin tur="kucuk" soluk>{ustaSayisi}/{tum.length}</Metin>
            </View>
            <Cubuk oran={ustaSayisi / Math.max(1, tum.length)} parilti />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {(Object.keys(USTALIK) as Ustalik[]).map((u) => {
                const I = USTALIK[u].ikon;
                return (
                  <View key={u} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <I size={14} color={USTALIK[u].renk[0]} />
                    <Metin tur="kucuk" soluk>{t(`harita.ustalik.${u}`)}</Metin>
                  </View>
                );
              })}
            </View>
          </Kart>
        )}

        {ders?.uniteler.map((u, ui) => {
          const yukseklik = u.kazanimlar.length * ADIM + 20;
          const noktalar = u.kazanimlar.map((_, i) => ({ x: (KONUM[i % KONUM.length] ?? 0.5) * GENISLIK, y: 40 + i * ADIM }));
          const yol = noktalar.map((n, i) => {
            if (i === 0) return `M ${n.x} ${n.y}`;
            const o = noktalar[i - 1] ?? n;
            return `C ${o.x} ${o.y + ADIM / 2}, ${n.x} ${n.y - ADIM / 2}, ${n.x} ${n.y}`;
          }).join(" ");
          return (
            <Animated.View key={u.id} entering={FadeInDown.delay(ui * 80).springify()} style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ height: 2, flex: 1, backgroundColor: tema.kenar }} />
                <Etiket metin={u.ad} renk={tema.vurgu} />
                <View style={{ height: 2, flex: 1, backgroundColor: tema.kenar }} />
              </View>
              <View style={{ width: GENISLIK, height: yukseklik, alignSelf: "center" }}>
                <Svg width={GENISLIK} height={yukseklik} style={{ position: "absolute" }}>
                  <Path d={yol} stroke={tema.kenar} strokeWidth={10} fill="none" strokeLinecap="round" />
                  <Path d={yol} stroke={`${tema.vurgu}55`} strokeWidth={4} strokeDasharray="2 12" fill="none" strokeLinecap="round" />
                </Svg>
                {u.kazanimlar.map((k, i) => {
                  const n = noktalar[i] ?? { x: 0, y: 0 };
                  const ust: Ustalik = beceri.get(k.id)?.ustalik ?? "kesfedilmedi";
                  const U = USTALIK[ust];
                  const sec = secili === k.id;
                  return (
                    <Animated.View key={k.id} entering={ZoomIn.delay(ui * 80 + i * 50).springify()} style={{ position: "absolute", left: n.x - 32, top: n.y - 32, alignItems: "center" }}>
                      <Basilabilir onPress={() => setSecili(sec ? null : k.id)} etiket={`${k.kod} ${t(`harita.ustalik.${ust}`)}`}>
                        <View style={{ width: 64, height: 64, borderRadius: 32, padding: 4, backgroundColor: sec ? tema.vurgu : tema.zemin, ...golge(2, ust === "kesfedilmedi" ? "#000" : U.renk[1]) }}>
                          <View style={{ flex: 1, borderRadius: 28, backgroundColor: U.renk[1], borderTopWidth: 5, borderTopColor: U.renk[0], alignItems: "center", justifyContent: "center" }}>
                            <U.ikon size={24} color={ust === "kesfedilmedi" ? "#8C8FBF" : "#fff"} fill={ust === "altin" ? "#ffffff55" : "transparent"} />
                          </View>
                        </View>
                      </Basilabilir>
                      <Metin tur="kucuk" soluk stil={{ fontSize: 10, marginTop: 2 }}>{k.kod}</Metin>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          );
        })}
        <View style={{ height: sKaz ? 200 : 0 }} />
      </Ekran>

      {sKaz && (
        <Animated.View key={sKaz.id} entering={SlideInDown.springify().damping(16)} style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <View style={{ padding: 18, gap: 10, borderRadius: 24, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar, ...golge(3, "#000") }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Etiket metin={sKaz.kod} renk={USTALIK[sUst].renk[0]} />
              <Metin tur="kucuk" soluk stil={{ flex: 1 }}>{t(`harita.ustalik.${sUst}`)}{sBec ? ` · ${t("harita.soruSayisi", { n: sBec.cozulen })}` : ""}</Metin>
              <Basilabilir onPress={() => setSecili(null)} etiket="kapat"><X size={20} color={tema.soluk} /></Basilabilir>
            </View>
            <Metin numberOfLines={3}>{sKaz.aciklama}</Metin>
            {eksik && sUst === "kesfedilmedi" && <Metin tur="kucuk" renk={tema.vurgu}>{t("harita.onceSunuDene", { kod: kodlar.get(eksik) ?? "" })}</Metin>}
            <Dugme ikon={Play} baslik={t("harita.calis")} onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: sKaz.kod, baslik: sKaz.kod } })} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}
