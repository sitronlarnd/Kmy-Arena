import { SIKLAR, type Sik } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { BookOpenCheck, Check, Lock, Minus, RotateCcw, Timer, Trophy, X } from "lucide-react-native";
import { AppState, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Konfeti, RozetKutlama } from "@/bilesenler/Kutlama";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { Avatar, RobotAvatar } from "@/bilesenler/sanat";
import { SikKarti } from "@/bilesenler/SikKarti";
import { Basilabilir, Dugme, Etiket, Halka, Kart, Metin, titret } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { useOyun } from "@/lib/oyun";
import { olculenRtt, saatGuncelle, sunucuSimdi } from "@/lib/saat";
import { supabase } from "@/lib/supabase";
import { BOYUT, GRADYAN, OYUN, golge, useTema, yazi } from "@/lib/tema";

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
  iyi_oyun: "İyi oyundu", rovans: "Rövanş?", alkis: "Alkış", saskin: "Vay be!",
  zor_soru: "Zor soruydu", tebrikler: "Tebrikler", sans: "Bol şans", hadi: "Hadi!",
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

  const [rozetler, setRozetler] = useState<string[]>([]);
  useEffect(() => {
    if (d?.durum === "bitti") {
      void sorgu.invalidateQueries({ queryKey: ["oyun"] });
      titret(d.kazanan === "ben" ? "basari" : "orta");
      if (d.yeni_rozetler?.length) setRozetler(d.yeni_rozetler);
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

  const rakipAd = d?.rakip?.robot ? t("duello.robotAd") : (d?.rakip?.takma_ad ?? "…");
  const toplamSure = tur ? Math.max(1, (sonAn - acilis) / 1000) : 1;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }}>
      <Stack.Screen options={{ headerShown: false }} />
      <RozetKutlama kodlar={rozetler} kapat={() => setRozetler((l) => l.slice(1))} />
      {d?.durum === "bitti" && d.kazanan === "ben" && <Konfeti anahtar={d.id} adet={60} />}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Basilabilir onPress={() => router.back()} etiket={t("soru.kapat")}>
            <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
              <X size={20} color={tema.metin} />
            </View>
          </Basilabilir>
          <Metin tur="altbaslik" stil={{ flex: 1 }}>{t("duello.baslik")}</Metin>
          {d && <Etiket metin={t(`duello.mod_${d.mod}` as MetinAnahtari)} renk={tema.vurgu} />}
        </View>
        {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
        {!d && !hata && <Metin soluk>{t("ortak.yukleniyor")}</Metin>}

        {/* Skor tablosu: VS */}
        {d && (
          <Animated.View entering={FadeInDown.springify()} style={{ borderRadius: 28, overflow: "hidden", ...golge(3, tema.vurgu) }}>
            <LinearGradient colors={["#2A1F6B", "#141631"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ alignItems: "center", gap: 6, width: 100 }}>
                  <Avatar tur={oyun?.karakter?.tur} seviye={oyun?.seviye} cerceve={oyun?.karakter?.cerceve} arkaPlan={oyun?.karakter?.arka_plan} kostum={oyun?.karakter?.kostum} boyut={64} />
                  <Metin tur="kucuk" renk="#fff">{t("duello.ben")}</Metin>
                </View>
                <View style={{ alignItems: "center" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Animated.Text key={`b${d.skor_ben}`} entering={ZoomIn.springify().damping(8)} style={{ color: "#fff", fontSize: 44, ...yazi("siyah") }}>{d.skor_ben}</Animated.Text>
                    <Metin tur="altbaslik" renk="#ffffff66">:</Metin>
                    <Animated.Text key={`r${d.skor_rakip}`} entering={ZoomIn.springify().damping(8)} style={{ color: "#fff", fontSize: 44, ...yazi("siyah") }}>{d.skor_rakip}</Animated.Text>
                  </View>
                  <Metin tur="etiket" renk="#FFC53D">VS</Metin>
                </View>
                <View style={{ alignItems: "center", gap: 6, width: 100 }}>
                  {d.rakip?.robot ? <RobotAvatar boyut={64} /> : <Avatar tur={d.rakip?.karakter} cerceve={d.rakip?.cerceve} boyut={64} />}
                  <Metin tur="kucuk" renk="#fff" numberOfLines={1}>{rakipAd}</Metin>
                </View>
              </View>
              {/* Tur noktaları */}
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
                {d.turlar.map((x) => {
                  const renk = !x.kapandi ? (x.sira === d.gecerli_tur ? "#FFC53D" : "#ffffff30") : x.kazanan === d.taraf ? tema.dogru : x.kazanan === null ? "#ffffff66" : tema.yanlis;
                  return <View key={x.sira} style={{ width: x.sira === d.gecerli_tur && !x.kapandi ? 22 : 10, height: 10, borderRadius: 5, backgroundColor: renk }} />;
                })}
              </View>
              {d.rakip_tepki && (
                <Animated.View key={d.rakip_tepki} entering={ZoomIn.springify()} style={{ alignSelf: "flex-end", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderBottomRightRadius: 4, backgroundColor: "#ffffff22" }}>
                  <Metin tur="kucuk" renk="#fff">{TEPKILER[d.rakip_tepki] ?? ""}</Metin>
                </Animated.View>
              )}
            </LinearGradient>
          </Animated.View>
        )}
        {d && d.sekme_uyari > 0 && d.durum === "oynaniyor" && d.mod === "dereceli" && <Etiket metin={t("duello.sekmeUyari")} renk={tema.yanlis} />}

        {d?.durum === "davet" && (
          <Kart vurgu={tema.vurgu}>
            <Metin tur="etiket" soluk ortala>{t("duello.davetKodu")}</Metin>
            <Metin tur="dev" ortala stil={{ letterSpacing: 8 }}>{d.davet_kodu}</Metin>
            <Metin soluk ortala>{t("duello.kodBekleniyor")}</Metin>
          </Kart>
        )}

        {/* Önceki turun sonucu */}
        {d?.durum === "oynaniyor" && oncekiTur && geriSayim !== null && (
          <Kart vurgu={oncekiTur.kazanan === d.taraf ? tema.dogru : oncekiTur.kazanan === null ? tema.soluk : tema.yanlis}>
            <Metin tur="altbaslik">
              {oncekiTur.kazanan === null ? t("duello.bosTur") : t("duello.turunKazanani", { ad: oncekiTur.kazanan === d.taraf ? t("duello.ben") : rakipAd })}
            </Metin>
            {oncekiTur.dogru && <Etiket metin={t("duello.dogruCevap", { sik: oncekiTur.dogru })} renk={tema.dogru} ikon={Check} />}
            {typeof oncekiTur.cozum === "string" && <MatematikMetni md={oncekiTur.cozum} renk={tema.metin} boyut={BOYUT.govde} />}
          </Kart>
        )}

        {/* Geri sayım: her sayı yaylanarak büyür */}
        {d?.durum === "oynaniyor" && tur && geriSayim !== null && (
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 6 }}>
            <Metin soluk>{t("duello.hazirlan")}</Metin>
            <Animated.Text key={geriSayim} entering={ZoomIn.springify().damping(7)} style={{ color: tema.vurgu, fontSize: 96, ...yazi("siyah") }}>{geriSayim}</Animated.Text>
          </View>
        )}

        {d?.durum === "oynaniyor" && tur?.soru && acik && (
          <Animated.View key={tur.sira} entering={FadeIn} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Halka oran={(kalan ?? 0) / toplamSure} boyut={56} kalinlik={6} gradyan={(kalan ?? 0) <= 5 ? GRADYAN.yanlis : GRADYAN.buz}>
                <Metin tur="altbaslik" renk={(kalan ?? 0) <= 5 ? tema.yanlis : tema.metin}>{kalan}</Metin>
              </Halka>
              <View style={{ flex: 1 }}>
                <Metin tur="kucuk" soluk>{t("duello.tur", { n: tur.sira, toplam: d.tur_sayisi })}</Metin>
                <Metin tur="kucuk" soluk numberOfLines={1}>{tur.soru.kazanim}</Metin>
              </View>
              {tur.rakip_cevapladi && tur.ben_dogru === null && <Etiket metin={t("duello.rakipCevapladi")} renk={OYUN.ates} ikon={Timer} />}
            </View>
            <View style={{ padding: 20, borderRadius: 24, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
              <MatematikMetni md={tur.soru.govde_md} renk={tema.metin} boyut={BOYUT.soruMetni} />
            </View>
            {tur.ben_dogru === false && <Etiket metin={t("duello.kilitli")} renk={tema.yanlis} ikon={Lock} />}
            <View style={{ gap: 10 }}>
              {SIKLAR.filter((h) => tur.soru?.siklar[h] !== undefined).map((h, i) => (
                <SikKarti
                  key={`${tur.sira}${h}`}
                  harf={h}
                  sira={i}
                  md={tur.soru?.siklar[h] ?? ""}
                  secili={false}
                  durum={tur.ben_secilen === h ? (tur.ben_dogru ? "dogru" : "yanlis") : null}
                  pasif={gonderiyor || tur.ben_dogru !== null}
                  onPress={() => { titret("orta"); void cevapla(h); }}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {d?.durum === "oynaniyor" && d.mod === "asenkron" && !tur && (
          <Kart><Metin soluk>{t("duello.asenkronBekliyor", { tarih: d.son_kullanma ? new Date(d.son_kullanma).toLocaleString("tr-TR") : "" })}</Metin></Kart>
        )}

        {d?.durum === "oynaniyor" && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityLabel={t("duello.tepkiler")}>
            {Object.entries(TEPKILER).map(([kod, etiket]) => (
              <Basilabilir key={kod} onPress={() => void api("/api/duello/tepki", { id, kod }).catch(() => undefined)} etiket={etiket}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: tema.kenar, backgroundColor: tema.yuzey }}>
                  <Metin tur="kucuk">{etiket}</Metin>
                </View>
              </Basilabilir>
            ))}
          </ScrollView>
        )}

        {d?.durum === "bitti" && (
          <>
            <Animated.View entering={ZoomIn.springify().damping(12)} style={{ borderRadius: 28, overflow: "hidden", ...golge(3, d.kazanan === "ben" ? OYUN.altin : "#000") }}>
              <LinearGradient
                colors={d.kazanan === "ben" ? GRADYAN.altin : d.kazanan === "rakip" ? ["#3A2A4F", "#1A1530"] : ["#2A2D52", "#171933"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{ padding: 22, gap: 10, alignItems: "center" }}
              >
                {d.kazanan === "ben" ? <Trophy size={56} color="#3A2400" fill="#ffffff55" /> : d.kazanan === "rakip" ? <RotateCcw size={48} color="#fff" /> : <Minus size={48} color="#fff" />}
                <Metin tur="dev" renk={d.kazanan === "ben" ? "#3A2400" : "#fff"}>
                  {d.kazanan === "ben" ? t("duello.kazandin") : d.kazanan === "rakip" ? t("duello.kaybettin") : t("duello.berabere")}
                </Metin>
                {d.hukmen && <Metin renk="#ffffffcc">{t("duello.hukmen")}</Metin>}
                {d.kupa !== 0 && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "#00000022" }}>
                    <Trophy size={18} color={d.kazanan === "ben" ? "#3A2400" : OYUN.kupa} />
                    <Metin tur="altbaslik" renk={d.kazanan === "ben" ? "#3A2400" : "#fff"}>{d.kupa > 0 ? `+${d.kupa}` : d.kupa} {t("duello.kupaEtiket")}</Metin>
                  </View>
                )}
                {d.kupa_durduruldu && <Metin tur="kucuk" renk="#ffffffaa">{t("duello.kupaDurduruldu")}</Metin>}
              </LinearGradient>
            </Animated.View>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <View style={{ flex: 1, minWidth: 150 }}><Dugme ikon={RotateCcw} baslik={d.rovans_kodu ? t("duello.rovansKatil") : t("duello.rovans")} onPress={() => void rovans()} /></View>
              {(() => {
                const kayip = d.turlar.find((x) => x.ben_dogru !== true && x.soru);
                return kayip?.soru ? (
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Dugme tur="ikincil" ikon={BookOpenCheck} baslik={t("duello.konuyuCalis")} onPress={() => router.push({ pathname: "/soru", params: { mod: "antrenman", kazanimKodu: kayip.soru?.kazanim ?? "" } })} />
                  </View>
                ) : null;
              })()}
            </View>
            <Metin tur="altbaslik" accessibilityRole="header">{t("duello.ozet")}</Metin>
            {d.turlar.map((x, i) => (
              <Kart key={x.sira} sira={i}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Metin tur="kucuk" soluk stil={{ flex: 1 }}>{t("duello.tur", { n: x.sira, toplam: d.tur_sayisi })}</Metin>
                  <Etiket metin={t("duello.ben")} renk={x.ben_dogru ? tema.dogru : x.ben_dogru === false ? tema.yanlis : tema.soluk} ikon={x.ben_dogru ? Check : x.ben_dogru === false ? X : Minus} />
                  <Etiket metin={rakipAd} renk={x.rakip_dogru ? tema.dogru : x.rakip_dogru === false ? tema.yanlis : tema.soluk} ikon={x.rakip_dogru ? Check : x.rakip_dogru === false ? X : Minus} />
                </View>
                {x.soru && <MatematikMetni md={x.soru.govde_md} renk={tema.metin} boyut={BOYUT.govde} />}
                {x.dogru && <Etiket metin={t("duello.dogruCevap", { sik: x.dogru })} renk={tema.dogru} ikon={Check} />}
                {Array.isArray(x.cozum) && x.cozum.map((c, j) => <MatematikMetni key={j} md={c} renk={tema.metin} boyut={BOYUT.govde} />)}
              </Kart>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
