import { LIG_KADEMELERI, ligAdimi } from "@kmy/shared";
import { Trophy } from "lucide-react-native";
import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Avatar } from "@/bilesenler/Avatar";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useOyun } from "@/lib/oyun";
import { useOturum } from "@/lib/oturum";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

interface Satir {
  sira: number;
  takma_ad: string;
  karakter: string | null;
  cerceve: string | null;
  ben: boolean;
}

type Kapsam = "lig" | "sinif" | "sube" | "dershane" | "dershaneler";

function Sekme({ etiket, aktif, onPress }: { etiket: string; aktif: boolean; onPress: () => void }) {
  const tema = useTema();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: aktif }}
      onPress={onPress}
      style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: aktif ? tema.vurgu : tema.kenar, backgroundColor: aktif ? tema.vurgu : tema.yuzey }}
    >
      <Text style={{ color: aktif ? "#fff" : tema.metin, fontWeight: "600" }}>{etiket}</Text>
    </Pressable>
  );
}

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

  return (
    <Ekran baslik={t("oyun.lig")}>
      <Stack.Screen options={{ headerShown: true, title: t("oyun.lig"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <Kart stil={{ borderColor: lig.renk }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Trophy size={26} color={lig.renk} fill={`${lig.renk}44`} /><Text style={{ color: lig.renk, fontSize: 24, fontWeight: "900" }}>{lig.ad}</Text></View>
        <Text style={{ color: tema.metin }}>{t("oyun.ligHafta", { xp: oyun?.haftalikXp ?? 0 })}</Text>
        <Text style={{ color: tema.soluk, fontSize: 13 }}>{t("oyun.ligAciklama")}</Text>
        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
          {LIG_KADEMELERI.map((k, i) => (
            <Text key={k.ad} style={{ color: i + 1 === lig.kademe ? k.renk : tema.soluk, fontWeight: i + 1 === lig.kademe ? "800" : "400", fontSize: 12 }}>{k.ad}</Text>
          ))}
        </View>
      </Kart>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="tablist">
        <Sekme etiket={t("oyun.lig")} aktif={kapsam === "lig"} onPress={() => setKapsam("lig")} />
        <Sekme etiket={t("oyun.sinif")} aktif={kapsam === "sinif"} onPress={() => setKapsam("sinif")} />
        <Sekme etiket={t("oyun.sube")} aktif={kapsam === "sube"} onPress={() => setKapsam("sube")} />
        <Sekme etiket={t("oyun.dershane")} aktif={kapsam === "dershane"} onPress={() => setKapsam("dershane")} />
        {dershaneArasi && <Sekme etiket={t("oyun.dershaneler")} aktif={kapsam === "dershaneler"} onPress={() => setKapsam("dershaneler")} />}
      </View>
      {kapsam !== "lig" && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Sekme etiket={t("oyun.buHafta")} aktif={donem === "hafta"} onPress={() => setDonem("hafta")} />
          <Sekme etiket={t("oyun.tumZamanlar")} aktif={donem === "tum"} onPress={() => setDonem("tum")} />
        </View>
      )}

      {kapsam === "lig" && !isLoading && n === 0 && <Text style={{ color: tema.soluk }}>{t("oyun.ligBos")}</Text>}
      {error && <Text style={{ color: tema.yanlis }}>{t("ortak.hata")}</Text>}
      <Kart>
        {data.map((r) => {
          const yukselen = kapsam === "lig" && r.sira <= (n >= 10 ? 5 : Math.max(1, Math.floor(n / 3))) && r.puan > 0;
          const dusen = kapsam === "lig" && n >= 10 && r.sira > n - 5;
          return (
            <View
              key={`${r.sira}-${r.takma_ad}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 8, backgroundColor: r.ben ? `${tema.vurgu}22` : "transparent" }}
            >
              <Text style={{ width: 28, color: yukselen ? tema.dogru : dusen ? tema.yanlis : tema.soluk, fontWeight: "700" }}>{r.sira}</Text>
              <Avatar tur={r.karakter} cerceve={r.cerceve} boyut={32} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: tema.metin, fontWeight: r.ben ? "800" : "500" }}>{r.takma_ad}{r.ben ? ` (${t("oyun.sen")})` : ""}</Text>
                {r.dershane && <Text style={{ color: tema.soluk, fontSize: 12 }}>{r.dershane}</Text>}
              </View>
              <Text style={{ color: tema.metin, fontVariant: ["tabular-nums"], fontSize: BOYUT.govde }}>{r.puan} XP</Text>
            </View>
          );
        })}
      </Kart>
    </Ekran>
  );
}
