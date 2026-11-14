import { useQuery } from "@tanstack/react-query";
import { ESYALAR, ROZETLER, type EsyaTuru } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { Stack, router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Coins, Snowflake, Sparkles, Zap } from "lucide-react-native";
import { Avatar } from "@/bilesenler/sanat";
import { IkonKutu } from "@/bilesenler/ui";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { api, ApiHatasi } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useOyun, useOyunYenile } from "@/lib/oyun";
import { BOYUT, useTema, OYUN } from "@/lib/tema";

const GRUPLAR: Array<{ tur: EsyaTuru; anahtar: MetinAnahtari }> = [
  { tur: "kostum", anahtar: "oyun.kostum" },
  { tur: "cerceve", anahtar: "oyun.cerceve" },
  { tur: "arka_plan", anahtar: "oyun.arka_plan" },
  { tur: "duello_efekti", anahtar: "oyun.duello_efekti" },
];

/** Kozmetik mağaza: fiyat ve koşullar sunucudaki katalogdan doğrulanır. */
export default function Magaza() {
  const tema = useTema();
  const oyun = useOyun().data;
  const yenile = useOyunYenile();
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const sahip = new Set(oyun?.envanter ?? []);
  // Merkezin mağaza ayarları: fiyat, satıştan kaldırma, yayın tarihi
  const ayar = useQuery({
    queryKey: ["esya_ayari"],
    queryFn: async () => ((await supabase.from("esya_ayari").select("kod, fiyat, aktif, yayin_tarihi")).data ?? []) as Array<{ kod: string; fiyat: number | null; aktif: boolean; yayin_tarihi: string | null }>,
    staleTime: 300_000,
  }).data ?? [];
  const ayarHaritasi = new Map(ayar.map((x) => [x.kod, x]));
  const esyalar = ESYALAR.map((e) => ({ ...e, fiyat: ayarHaritasi.get(e.kod)?.fiyat ?? e.fiyat })).filter((e) => {
    const a = ayarHaritasi.get(e.kod);
    return !a || sahip.has(e.kod) || (a.aktif && (!a.yayin_tarihi || Date.parse(a.yayin_tarihi) <= Date.now()));
  });
  const kar = oyun?.karakter;

  const islem = async (anahtar: string, yol: string, govde: unknown) => {
    setMesgul(anahtar);
    setMesaj(null);
    try {
      await api(yol, govde);
      yenile();
    } catch (h) {
      setMesaj(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    } finally {
      setMesgul(null);
    }
  };

  const unvanlar = ROZETLER.filter((r) => r.unvan && oyun?.rozetler.includes(r.kod));

  return (
    <Ekran baslik={t("oyun.magaza")}>
      <Stack.Screen options={{ headerShown: true, title: t("oyun.magaza"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <Kart>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Avatar tur={kar?.tur} seviye={oyun?.seviye} cerceve={kar?.cerceve} arkaPlan={kar?.arka_plan} kostum={kar?.kostum} boyut={72} />
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Coins size={22} color={OYUN.altin} fill={`${OYUN.altin}55`} /><Text style={{ color: tema.metin, fontSize: 22, fontWeight: "900" }}>{oyun?.altin ?? 0}</Text></View>
            <Text style={{ color: tema.soluk, fontSize: 13 }}>{t("oyun.magazaAciklama")}</Text>
          </View>
        </View>
        {!kar && <Dugme baslik={t("oyun.karakterSec")} onPress={() => router.push("/karakter")} />}
        {kar && <Dugme ikincil baslik={t("oyun.karakterSec")} onPress={() => router.push("/karakter")} />}
      </Kart>
      {mesaj && <Text style={{ color: tema.yanlis }}>{mesaj}</Text>}

      {(() => {
        const d = esyalar.find((e) => e.tur === "seri_dondurucu");
        if (!d) return null;
        return (
          <Kart>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><IkonKutu ikon={Snowflake} renk={OYUN.buz} /><Text style={{ color: tema.metin, fontWeight: "700", flex: 1 }}>{d.ad} · {t("oyun.dondurucu", { n: oyun?.dondurucu ?? 0 })}/2</Text></View>
            <Dugme baslik={t("oyun.satinAl", { fiyat: d.fiyat })} yukleniyor={mesgul === d.kod} onPress={() => void islem(d.kod, "/api/oyun/satin-al", { kod: d.kod })} />
          </Kart>
        );
      })()}

      {GRUPLAR.map((g) => (
        <View key={g.tur} style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>{t(g.anahtar)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {esyalar.filter((e) => e.tur === g.tur).map((e) => {
              const var_ = sahip.has(e.kod);
              const kusanili = kar?.[g.tur as "kostum" | "cerceve" | "arka_plan" | "duello_efekti"] === e.kod;
              const kilitli = Boolean(e.minSeviye && (oyun?.seviye ?? 1) < e.minSeviye);
              return (
                <View key={e.kod} style={{ width: 160, padding: 12, gap: 6, borderRadius: BOYUT.yaricap, borderWidth: 2, borderColor: kusanili ? tema.vurgu : tema.kenar, backgroundColor: tema.yuzey }}>
                  <View style={{ height: 76, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: tema.zemin }}>
                    {g.tur === "duello_efekti" ? (
                      e.kod === "efekt_yildirim" ? <Zap size={36} color={OYUN.altin} fill={`${OYUN.altin}55`} /> : <Sparkles size={36} color={OYUN.xp} />
                    ) : (
                      <Avatar tur={kar?.tur ?? "bilge_baykus"} boyut={64} aura={false}
                        kostum={g.tur === "kostum" ? e.kod : null} cerceve={g.tur === "cerceve" ? e.kod : null} arkaPlan={g.tur === "arka_plan" ? e.kod : null} />
                    )}
                  </View>
                  <Text style={{ color: tema.metin, fontWeight: "700" }}>{e.ad}</Text>
                  {var_ ? (
                    kusanili ? (
                      <Dugme ikincil baslik={t("oyun.cikar")} yukleniyor={mesgul === e.kod} onPress={() => void islem(e.kod, "/api/oyun/kusan", { tur: g.tur, kod: null })} />
                    ) : (
                      <Dugme baslik={t("oyun.kusan")} yukleniyor={mesgul === e.kod} pasif={!kar} onPress={() => void islem(e.kod, "/api/oyun/kusan", { tur: g.tur, kod: e.kod })} />
                    )
                  ) : e.rozetle ? (
                    <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("oyun.rozetleKazanilir")}</Text>
                  ) : kilitli ? (
                    <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("oyun.seviyeGerek", { n: e.minSeviye ?? 0 })}</Text>
                  ) : (
                    <Dugme baslik={t("oyun.satinAl", { fiyat: e.fiyat })} yukleniyor={mesgul === e.kod} pasif={(oyun?.altin ?? 0) < e.fiyat} onPress={() => void islem(e.kod, "/api/oyun/satin-al", { kod: e.kod })} />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}

      <Text accessibilityRole="header" style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>{t("oyun.unvan")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {unvanlar.length === 0 && <Text style={{ color: tema.soluk }}>{t("oyun.unvanYok")}</Text>}
        {unvanlar.map((r) => {
          const aktif = kar?.unvan === r.unvan;
          return (
            <Dugme
              key={r.kod}
              ikincil={!aktif}
              baslik={r.unvan ?? ""}
              pasif={!kar}
              yukleniyor={mesgul === r.kod}
              onPress={() => void islem(r.kod, "/api/oyun/kusan", { tur: "unvan", kod: aktif ? null : r.unvan })}
            />
          );
        })}
      </View>
    </Ekran>
  );
}
