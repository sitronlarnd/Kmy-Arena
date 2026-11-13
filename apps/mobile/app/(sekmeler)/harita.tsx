import type { Ustalik } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useBeceriler, useMufredat } from "@/lib/sorgular";
import { BOYUT, useTema } from "@/lib/tema";

const USTALIK_RENGI: Record<Ustalik, string> = { kesfedilmedi: "#9AA0B4", bronz: "#B87333", gumus: "#8E9AAF", altin: "#D4A017" };

/** Konu haritası: ders = kıta, ünite = bölge, kazanım = durak (renk = ustalık). */
export default function Harita() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const beceri = useBeceriler().data ?? new Map();
  const kodlar = new Map(dersler.flatMap((d) => d.uniteler.flatMap((u) => u.kazanimlar.map((k) => [k.id, k.kod] as const))));

  return (
    <Ekran baslik={t("sekmeler.harita")}>
      <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("harita.aciklama")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {(Object.keys(USTALIK_RENGI) as Ustalik[]).map((u) => (
          <View key={u} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: USTALIK_RENGI[u] }} />
            <Text style={{ color: tema.soluk, fontSize: 13 }}>{t(`harita.ustalik.${u}`)}</Text>
          </View>
        ))}
      </View>
      {dersler.map((d) => (
        <View key={d.id} style={{ gap: 10 }}>
          <Text accessibilityRole="header" style={{ color: tema.metin, fontSize: 20, fontWeight: "800" }}>{d.ad} · {d.sinav_turu}</Text>
          {d.uniteler.map((u) => (
            <Kart key={u.id}>
              <Text style={{ color: tema.metin, fontWeight: "700", fontSize: 16 }}>{u.ad}</Text>
              {u.kazanimlar.map((k) => {
                const b = beceri.get(k.id);
                const ustalik: Ustalik = b?.ustalik ?? "kesfedilmedi";
                const eksikOnKosul = k.on_kosullar.find((o) => {
                  const ob = beceri.get(o);
                  return !ob || ob.ustalik === "kesfedilmedi";
                });
                return (
                  <Pressable
                    key={k.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${k.kod} ${t(`harita.ustalik.${ustalik}`)}`}
                    onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: k.kod, baslik: k.kod } })}
                    style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: BOYUT.dokunma, paddingVertical: 6 }}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 2, backgroundColor: USTALIK_RENGI[ustalik], borderWidth: 2, borderColor: tema.yuzey }} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ color: tema.metin, fontWeight: "600" }}>{k.kod}</Text>
                      <Text style={{ color: tema.soluk, fontSize: 13 }}>{k.aciklama}</Text>
                      <Text style={{ color: tema.soluk, fontSize: 12 }}>
                        {t(`harita.ustalik.${ustalik}`)}{b ? ` · ${t("harita.soruSayisi", { n: b.cozulen })}` : ""}
                      </Text>
                      {eksikOnKosul && ustalik === "kesfedilmedi" && (
                        <Text style={{ color: tema.vurgu, fontSize: 12 }}>{t("harita.onceSunuDene", { kod: kodlar.get(eksikOnKosul) ?? "" })}</Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </Kart>
          ))}
        </View>
      ))}
    </Ekran>
  );
}
