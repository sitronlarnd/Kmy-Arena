import { ROZETLER, SIKLAR, type Sik } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Avatar } from "@/bilesenler/Avatar";
import { Dugme } from "@/bilesenler/Dugme";
import { Kart } from "@/bilesenler/Kart";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { api, ApiHatasi } from "@/lib/api";
import { useOyun } from "@/lib/oyun";
import { olculenRtt, saatGuncelle, sunucuSimdi } from "@/lib/saat";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

interface Tur {
  sira: number;
  sure_sn: number;
  acilis: string | null;
  son_an: string | null;
  kapandi: boolean;
  kazanan: "a" | "b" | null;
  ben_secilen: Sik | null;
  ben_dogru: boolean | null;
  rakip_cevapladi: boolean;
  rakip_dogru: boolean | null;
  soru: { id: string; govde_md: string; siklar: Partial<Record<Sik, string>>; zorluk: number; kazanim: string } | null;
  dogru: Sik | null;
  cozum: string | string[] | null;
}

interface Durum {
  id: string;
  mod: "dereceli" | "arkadas" | "robot" | "asenkron";
  durum: "davet" | "oynaniyor" | "bitti" | "iptal";
  taraf: "a" | "b";
  davet_kodu: string | null;
  gecerli_tur: number;
  tur_sayisi: number;
  skor_ben: number;
  skor_rakip: number;
  kazanan: "ben" | "rakip" | "berabere" | null;
  kupa: number;
  kupa_durduruldu: boolean;
  hukmen: boolean;
  rakip: { robot: boolean; takma_ad: string; karakter?: string | null; cerceve?: string | null; kupa?: number } | null;
  sekme_uyari: number;
  rakip_tepki: string | null;
  rovans_kodu: string | null;
  son_kullanma: string | null;
  sunucu_zamani: number;
  turlar: Tur[];
  yeni_rozetler?: string[];
}

const TEPKILER: Record<string, string> = {
  iyi_oyun: "👏 İyi oyundu", rovans: "🔁 Rövanş?", alkis: "👏👏", saskin: "😮",
  zor_soru: "🤯 Zor soruydu", tebrikler: "🎉 Tebrikler", sans: "🍀 Bol şans", hadi: "💪 Hadi!",
};

const ms = (iso: string | null) => (iso ? Date.parse(iso) : Number.POSITIVE_INFINITY);

export default function DuelloOyun() {
  const tema = useTema();
  const sorgu = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const oyun = useOyun().data;
  const [d, setD] = useState<Durum | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [simdi, setSimdi] = useState(sunucuSimdi());
  const [gonderiyor, setGonderiyor] = useState(false);
  const yukleniyor = useRef(false);

  const yenile = useCallback(async () => {
    if (!id || yukleniyor.current) return;
    yukleniyor.current = true;
    const t0 = Date.now();
    try {
      const y = await api<Durum>("/api/duello/durum", { id });
      saatGuncelle(y.sunucu_zamani, t0, Date.now());
      setD(y);
      setHata(null);
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    } finally {
      yukleniyor.current = false;
    }
  }, [id]);

  // Yoklama (1 sn) + Realtime dürtüsü (rakip cevapladığında anında)
  useEffect(() => {
    void yenile();
    const i = setInterval(() => void yenile(), 1000);
    const kanal = supabase.channel(`duello:${id}`).on("broadcast", { event: "guncellendi" }, () => void yenile()).subscribe();
    return () => {
      clearInterval(i);
      void supabase.removeChannel(kanal);
    };
  }, [id, yenile]);

  // Saat (geri sayım ve açılış anı sunucu saatine göre)
  useEffect(() => {
    const i = setInterval(() => setSimdi(sunucuSimdi()), 100);
    return () => clearInterval(i);
  }, []);

  // Uygulama arka plana / sekme değişimi → bildir
  useEffect(() => {
    const abone = AppState.addEventListener("change", (durum) => {
      if (durum !== "active" && d?.durum === "oynaniyor") void api("/api/duello/sekme", { id }).catch(() => undefined);
    });
    return () => abone.remove();
  }, [id, d?.durum]);

  useEffect(() => {
    if (d?.durum === "bitti") {
      void sorgu.invalidateQueries({ queryKey: ["oyun"] });
    }
  }, [d?.durum, sorgu]);

  const tur = d ? (d.mod === "asenkron" ? d.turlar.find((x) => x.ben_dogru === null) : d.turlar.find((x) => x.sira === d.gecerli_tur)) : undefined;
  const acilis = tur ? ms(tur.acilis) : Number.POSITIVE_INFINITY;
  const sonAn = tur ? ms(tur.son_an) : 0;
  const acik = Boolean(tur && simdi >= acilis && !tur.kapandi && simdi < sonAn);
  const geriSayim = tur && simdi < acilis ? Math.ceil((acilis - simdi) / 1000) : null;
  const kalan = tur && acik ? Math.max(0, Math.ceil((sonAn - simdi) / 1000)) : null;
  const oncekiTur = d && d.mod !== "asenkron" ? [...d.turlar].reverse().find((x) => x.kapandi && x.sira < d.gecerli_tur) : undefined;

  const cevapla = async (sik: Sik | null) => {
    if (!tur || gonderiyor) return;
    setGonderiyor(true);
    try {
      await api("/api/duello/cevap", { id, sira: tur.sira, secilen: sik, rttMs: olculenRtt() });
      await yenile();
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    } finally {
      setGonderiyor(false);
    }
  };

  const rovans = async () => {
    try {
      if (d?.rovans_kodu) {
        const y = await api<{ duelloId: string }>("/api/duello/katil", { kod: d.rovans_kodu });
        router.replace(`/duello/${y.duelloId}`);
        return;
      }
      const y = await api<{ duelloId: string; davetKodu: string }>("/api/duello/rovans", { id });
      router.replace(`/duello/${y.duelloId}`);
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  };

  const rakipAd = d?.rakip?.robot ? `🤖 ${t("duello.robotAd")}` : (d?.rakip?.takma_ad ?? "…");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }} edges={["bottom"]}>
      <Stack.Screen options={{ headerShown: true, title: t("duello.baslik"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
        {!d && !hata && <Text style={{ color: tema.soluk }}>{t("ortak.yukleniyor")}</Text>}

        {d && (
          <Kart>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ alignItems: "center", gap: 4, width: 110 }}>
                <Avatar tur={oyun?.karakter?.tur} cerceve={oyun?.karakter?.cerceve} arkaPlan={oyun?.karakter?.arka_plan} kostum={oyun?.karakter?.kostum} boyut={52} />
                <Text style={{ color: tema.metin, fontWeight: "700" }}>{t("duello.ben")}</Text>
              </View>
              <Text style={{ color: tema.metin, fontSize: 32, fontWeight: "900" }}>{d.skor_ben} – {d.skor_rakip}</Text>
              <View style={{ alignItems: "center", gap: 4, width: 110 }}>
                {d.rakip?.robot ? <Text style={{ fontSize: 40 }}>🤖</Text> : <Avatar tur={d.rakip?.karakter} cerceve={d.rakip?.cerceve} boyut={52} />}
                <Text style={{ color: tema.metin, fontWeight: "700" }} numberOfLines={1}>{rakipAd}</Text>
              </View>
            </View>
            {d.rakip_tepki && <Text style={{ color: tema.vurgu, textAlign: "right", fontSize: 16 }}>{TEPKILER[d.rakip_tepki] ?? ""}</Text>}
            {d.durum === "oynaniyor" && d.mod !== "asenkron" && (
              <Text style={{ color: tema.soluk, textAlign: "center" }}>{t("duello.tur", { n: d.gecerli_tur, toplam: d.tur_sayisi })}</Text>
            )}
            {d.sekme_uyari > 0 && d.durum === "oynaniyor" && d.mod === "dereceli" && <Text style={{ color: tema.yanlis, fontSize: 12 }}>{t("duello.sekmeUyari")}</Text>}
          </Kart>
        )}

        {d?.durum === "davet" && (
          <Kart stil={{ borderColor: tema.vurgu }}>
            <Text style={{ color: tema.metin, fontSize: 24, fontWeight: "900", textAlign: "center", letterSpacing: 4 }}>{d.davet_kodu}</Text>
            <Text style={{ color: tema.soluk, textAlign: "center" }}>{t("duello.kodBekleniyor")}</Text>
          </Kart>
        )}

        {/* Önceki turun sonucu (5 sn ara) */}
        {d?.durum === "oynaniyor" && oncekiTur && geriSayim !== null && (
          <Kart>
            <Text style={{ color: tema.metin, fontWeight: "700" }}>
              {oncekiTur.kazanan === null ? t("duello.bosTur") : t("duello.turunKazanani", { ad: oncekiTur.kazanan === d.taraf ? t("duello.ben") : rakipAd })}
            </Text>
            {oncekiTur.dogru && <Text style={{ color: tema.dogru }}>{t("duello.dogruCevap", { sik: oncekiTur.dogru })}</Text>}
            {typeof oncekiTur.cozum === "string" && <MatematikMetni md={oncekiTur.cozum} renk={tema.metin} boyut={BOYUT.govde} />}
          </Kart>
        )}

        {d?.durum === "oynaniyor" && tur && geriSayim !== null && (
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <Text style={{ color: tema.soluk }}>{t("duello.hazirlan")}</Text>
            <Text style={{ color: tema.vurgu, fontSize: 64, fontWeight: "900" }}>{geriSayim}</Text>
          </View>
        )}

        {d?.durum === "oynaniyor" && tur?.soru && acik && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: tema.soluk }}>{tur.soru.kazanim}</Text>
              <Text style={{ color: (kalan ?? 0) <= 5 ? tema.yanlis : tema.metin, fontWeight: "800" }}>⏱ {kalan}</Text>
            </View>
            <Kart>
              <MatematikMetni md={tur.soru.govde_md} renk={tema.metin} boyut={BOYUT.soruMetni} />
            </Kart>
            {tur.ben_dogru === false && <Text style={{ color: tema.yanlis, fontWeight: "700" }}>{t("duello.kilitli")}</Text>}
            {tur.rakip_cevapladi && tur.ben_dogru === null && <Text style={{ color: tema.soluk }}>{t("duello.rakipCevapladi")}</Text>}
            <View style={{ gap: 10 }}>
              {SIKLAR.filter((h) => tur.soru?.siklar[h] !== undefined).map((h) => (
                <Pressable
                  key={h}
                  accessibilityRole="button"
                  accessibilityLabel={`${h} şıkkı`}
                  disabled={gonderiyor || tur.ben_dogru !== null}
                  onPress={() => void cevapla(h)}
                  style={({ pressed }) => ({
                    flexDirection: "row", gap: 12, alignItems: "center", minHeight: 52, padding: 12, borderRadius: BOYUT.yaricap, borderWidth: 2,
                    borderColor: tur.ben_secilen === h ? tema.yanlis : tema.kenar, backgroundColor: tema.yuzey, opacity: pressed || tur.ben_dogru !== null ? 0.7 : 1,
                  })}
                >
                  <Text style={{ fontWeight: "800", color: tema.metin, width: 22 }}>{h}</Text>
                  <View style={{ flex: 1 }}><MatematikMetni md={tur.soru?.siklar[h] ?? ""} renk={tema.metin} boyut={BOYUT.govde} /></View>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {d?.durum === "oynaniyor" && d.mod === "asenkron" && !tur && (
          <Text style={{ color: tema.soluk }}>{t("duello.asenkronBekliyor", { tarih: d.son_kullanma ? new Date(d.son_kullanma).toLocaleString("tr-TR") : "" })}</Text>
        )}

        {d?.durum === "oynaniyor" && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }} accessibilityLabel={t("duello.tepkiler")}>
            {Object.entries(TEPKILER).map(([kod, etiket]) => (
              <Pressable key={kod} onPress={() => void api("/api/duello/tepki", { id, kod }).catch(() => undefined)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: tema.kenar, backgroundColor: tema.yuzey }}>
                <Text style={{ color: tema.metin, fontSize: 13 }}>{etiket}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {d?.durum === "bitti" && (
          <>
            <Kart stil={{ borderColor: d.kazanan === "ben" ? tema.dogru : d.kazanan === "rakip" ? tema.yanlis : tema.kenar }}>
              <Text style={{ fontSize: 24, fontWeight: "900", color: tema.metin }}>
                {d.kazanan === "ben" ? t("duello.kazandin") : d.kazanan === "rakip" ? t("duello.kaybettin") : t("duello.berabere")}
              </Text>
              {d.hukmen && <Text style={{ color: tema.soluk }}>{t("duello.hukmen")}</Text>}
              {d.kupa !== 0 && <Text style={{ color: tema.vurgu, fontWeight: "700" }}>🏆 {t("duello.kupa", { n: d.kupa > 0 ? `+${d.kupa}` : d.kupa })}</Text>}
              {d.kupa_durduruldu && <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("duello.kupaDurduruldu")}</Text>}
              {(d.yeni_rozetler ?? []).map((k) => {
                const r = ROZETLER.find((x) => x.kod === k);
                return <Text key={k} style={{ color: tema.vurgu, fontWeight: "700" }}>{r?.emoji} {t("oyun.yeniRozet", { ad: r?.ad ?? k })}</Text>;
              })}
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Dugme baslik={d.rovans_kodu ? t("duello.rovansKatil") : t("duello.rovans")} onPress={() => void rovans()} />
                {(() => {
                  const kayip = d.turlar.find((x) => x.ben_dogru !== true && x.soru);
                  return kayip?.soru ? (
                    <Dugme ikincil baslik={t("duello.konuyuCalis")} onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: kayip.soru?.kazanim ?? "" } })} />
                  ) : null;
                })()}
              </View>
            </Kart>
            <Text accessibilityRole="header" style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>{t("duello.ozet")}</Text>
            {d.turlar.map((x) => (
              <Kart key={x.sira}>
                <Text style={{ color: tema.soluk, fontSize: 12 }}>
                  {t("duello.tur", { n: x.sira, toplam: d.tur_sayisi })} · {x.ben_dogru ? "✅" : x.ben_dogru === false ? "❌" : "—"} {t("duello.ben")} · {x.rakip_dogru ? "✅" : x.rakip_dogru === false ? "❌" : "—"} {rakipAd}
                </Text>
                {x.soru && <MatematikMetni md={x.soru.govde_md} renk={tema.metin} boyut={BOYUT.govde} />}
                {x.dogru && <Text style={{ color: tema.dogru }}>{t("duello.dogruCevap", { sik: x.dogru })}</Text>}
                {Array.isArray(x.cozum) && x.cozum.map((c, i) => <MatematikMetni key={i} md={c} renk={tema.metin} boyut={BOYUT.govde} />)}
              </Kart>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
