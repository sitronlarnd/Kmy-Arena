import type { CevapYaniti, IpucuYaniti, IstemciSorusu, Sik, SiradakiYaniti, SoruModu } from "@kmy/shared";
import { ROZETLER, SIKLAR } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import {
  BookOpenCheck, Check, CheckCircle2, Clock, Coins, Flag, Flame, Lightbulb, MessageCircleQuestion, Shield, SkipForward, Sparkles, Swords, Target, X, XCircle,
} from "lucide-react-native";
import { ActivityIndicator, ScrollView, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInDown, ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { SikKarti } from "@/bilesenler/SikKarti";
import { Konfeti, RozetKutlama, SeviyeKutlama, UcanOdul } from "@/bilesenler/Kutlama";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { RozetMadalya } from "@/bilesenler/sanat";
import { Basilabilir, Cubuk, Dugme, Etiket, IkonKutu, Kart, Metin, titret, useSarsinti } from "@/bilesenler/ui";
import { useOyun } from "@/lib/oyun";
import { useOturum } from "@/lib/oturum";
import { api, ApiHatasi } from "@/lib/api";
import { BOYUT, GRADYAN, OYUN, golge, useTema } from "@/lib/tema";

const ANTRENMAN_SORU = 10;
const BEKLEME_SINIRI = 15;

type Ekran =
  | { ad: "yukleniyor" }
  | { ad: "bekle"; deneme: number }
  | { ad: "soru" }
  | { ad: "sonuc"; c: CevapYaniti }
  | { ad: "bilgi"; anahtar: MetinAnahtari }
  | { ad: "ozet" };

function metin(anahtar: string): string {
  return t(anahtar as MetinAnahtari);
}

export default function SoruEkrani() {
  const tema = useTema();
  const sorgu = useQueryClient();
  const p = useLocalSearchParams<{ mod?: string; dersKodu?: string; kazanimKodu?: string; tespitDersKodu?: string; baslik?: string }>();
  const mod: SoruModu = p.mod === "tekrar" || p.mod === "tespit" ? p.mod : "antrenman";

  const [ekran, setEkran] = useState<Ekran>({ ad: "yukleniyor" });
  const [soru, setSoru] = useState<IstemciSorusu | null>(null);
  const [secilen, setSecilen] = useState<Sik | null>(null);
  const [ipuclari, setIpuclari] = useState<string[]>([]);
  const [ipucuVar, setIpucuVar] = useState(false);
  const [gonderiyor, setGonderiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bildirildi, setBildirildi] = useState(false);
  const [klanaSoruldu, setKlanaSoruldu] = useState<string | null>(null);
  const [tespit, setTespit] = useState<{ cevaplanan: number; toplam: number } | null>(null);
  const [oturum, setOturum] = useState({ n: 0, dogru: 0, xp: 0, altin: 0 });
  const [gecen, setGecen] = useState(0);
  const [kutlama, setKutlama] = useState<number | null>(null);
  const [rozetKuyrugu, setRozetKuyrugu] = useState<string[]>([]);
  const [konfeti, setKonfeti] = useState(0);
  const [ardisik, setArdisik] = useState(0);
  const sarsinti = useSarsinti();
  const asistanAcik = useOturum((x) => x.ozellikler.asistan !== false);
  const karakter = useOyun().data?.karakter ?? null;
  const baslangic = useRef(0);
  const zamanlayici = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getir = useCallback(
    async (deneme = 0) => {
      setHata(null);
      setEkran(deneme === 0 ? { ad: "yukleniyor" } : { ad: "bekle", deneme });
      try {
        const y = await api<SiradakiYaniti>("/api/soru/siradaki", {
          mod,
          ...(p.dersKodu ? { dersKodu: p.dersKodu } : {}),
          ...(p.kazanimKodu ? { kazanimKodu: p.kazanimKodu } : {}),
          ...(p.tespitDersKodu ? { tespitDersKodu: p.tespitDersKodu } : {}),
        });
        if (y.durum === "soru") {
          setSoru(y.soru);
          setSecilen(null);
          setIpuclari([]);
          setIpucuVar(y.soru.ipucuVar && mod !== "tespit");
          setBildirildi(false);
          setTespit(y.tespit ?? null);
          baslangic.current = Date.now();
          setGecen(0);
          setEkran({ ad: "soru" });
        } else if (y.durum === "hazirlaniyor") {
          if (deneme >= BEKLEME_SINIRI) {
            setEkran({ ad: "bilgi", anahtar: "soru.yedekMod" });
            return;
          }
          setEkran({ ad: "bekle", deneme: deneme + 1 });
          zamanlayici.current = setTimeout(() => void getir(deneme + 1), y.tekrarDeneMs);
        } else if (y.durum === "tekrar_yok") {
          setEkran(oturum.n > 0 ? { ad: "ozet" } : { ad: "bilgi", anahtar: "soru.tekrarYok" });
        } else if (y.durum === "tespit_bitti") {
          setEkran({ ad: "bilgi", anahtar: oturum.n > 0 ? "soru.tespitSonuc" : "soru.tespitBitti" });
        } else {
          setEkran({ ad: "bilgi", anahtar: "soru.yedekMod" });
        }
      } catch (h) {
        setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
        setEkran({ ad: "bilgi", anahtar: "ortak.hata" });
      }
    },
    [mod, p.dersKodu, p.kazanimKodu, p.tespitDersKodu, oturum.n],
  );

  useEffect(() => {
    void getir(0);
    return () => {
      if (zamanlayici.current) clearTimeout(zamanlayici.current);
    };
    // Yalnızca ilk açılışta
  }, []);

  useEffect(() => {
    if (ekran.ad !== "soru") return;
    const i = setInterval(() => setGecen(Math.floor((Date.now() - baslangic.current) / 1000)), 1000);
    return () => clearInterval(i);
  }, [ekran.ad]);

  const cevapla = async (bos: boolean) => {
    if (!soru || gonderiyor) return;
    setGonderiyor(true);
    setHata(null);
    try {
      const c = await api<CevapYaniti>("/api/soru/cevap", { soruId: soru.id, secilen: bos ? null : secilen, sureMs: Date.now() - baslangic.current });
      setOturum((o) => ({ n: o.n + 1, dogru: o.dogru + (c.sonuc === "dogru" ? 1 : 0), xp: o.xp + c.xp, altin: o.altin + c.altin }));
      setEkran({ ad: "sonuc", c });
      if (c.sonuc === "dogru") {
        titret("basari");
        setArdisik((a) => a + 1);
        if (ardisik + 1 >= 3 || c.oyun?.hedefTamam) setKonfeti((k) => k + 1);
      } else {
        titret("hata");
        setArdisik(0);
        sarsinti.salla();
      }
      if (c.seviyeAtladi) setKutlama(c.seviye);
      if (c.oyun?.yeniRozetler.length) setRozetKuyrugu(c.oyun.yeniRozetler);
      void sorgu.invalidateQueries({ queryKey: ["oyun"] });
      void sorgu.invalidateQueries({ queryKey: ["ilerleme"] });
      void sorgu.invalidateQueries({ queryKey: ["beceri"] });
      void sorgu.invalidateQueries({ queryKey: ["hata-defteri"] });
      void sorgu.invalidateQueries({ queryKey: ["tespit"] });
    } catch (h) {
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    } finally {
      setGonderiyor(false);
    }
  };

  const ipucuIste = async () => {
    if (!soru) return;
    try {
      const y = await api<IpucuYaniti>("/api/soru/ipucu", { soruId: soru.id });
      setIpuclari((l) => [...l, y.ipucu]);
      setIpucuVar(y.kalan > 0 && y.sira < 3);
    } catch (h) {
      setIpucuVar(false);
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    }
  };

  const hataBildir = async () => {
    if (!soru || bildirildi) return;
    try {
      await api("/api/soru/hata-bildir", { soruId: soru.id });
      setBildirildi(true);
    } catch (h) {
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    }
  };

  const klanaSor = async () => {
    if (!soru || klanaSoruldu === soru.id) return;
    try {
      await api("/api/klan/mesaj", { tur: "soru", soruId: soru.id });
      setKlanaSoruldu(soru.id);
    } catch (h) {
      setHata(metin(h instanceof ApiHatasi ? h.message : "ortak.hata"));
    }
  };

  const sonraki = () => {
    if (ekran.ad === "sonuc" && ekran.c.tespitBitti) {
      setEkran({ ad: "bilgi", anahtar: "soru.tespitSonuc" });
      return;
    }
    if (mod === "antrenman" && oturum.n >= ANTRENMAN_SORU) {
      setEkran({ ad: "ozet" });
      return;
    }
    void getir(0);
  };

  const baslik = mod === "tespit" ? t("soru.tespitBaslik") : mod === "tekrar" ? t("arena.hataDefteri") : (p.baslik ?? t("arena.soruCoz"));
  const sayac =
    mod === "tespit" && tespit
      ? t("soru.soruSayaci", { n: Math.min(tespit.cevaplanan + 1, tespit.toplam), toplam: tespit.toplam })
      : mod === "antrenman"
        ? t("soru.soruSayaci", { n: Math.min(oturum.n + (ekran.ad === "sonuc" ? 0 : 1), ANTRENMAN_SORU), toplam: ANTRENMAN_SORU })
        : null;
  const sikHarfleri = soru ? SIKLAR.filter((h) => soru.siklar[h] !== undefined) : [];
  const sonuc = ekran.ad === "sonuc" ? ekran.c : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tema.zemin }}>
      <Stack.Screen options={{ headerShown: false }} />
      <SeviyeKutlama seviye={kutlama} karakter={karakter} kapat={() => setKutlama(null)} />
      {kutlama === null && <RozetKutlama kodlar={rozetKuyrugu} kapat={() => setRozetKuyrugu((l) => l.slice(1))} />}
      <LinearGradient
        pointerEvents="none"
        colors={sonuc ? [`${sonuc.sonuc === "dogru" ? tema.dogru : tema.yanlis}33`, `${tema.zemin}00`] : [`${tema.vurgu}30`, `${tema.vurgu}00`]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: 280 }}
      />

      {/* Üst çubuk: geri, oturum ilerlemesi, süre */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        <Basilabilir onPress={() => (oturum.n > 0 && mod === "antrenman" && ekran.ad !== "ozet" ? setEkran({ ad: "ozet" }) : router.back())} etiket={t("soru.kapat")}>
          <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
            <X size={20} color={tema.metin} />
          </View>
        </Basilabilir>
        <View style={{ flex: 1, gap: 4 }}>
          <Metin tur="kucuk" soluk numberOfLines={1}>{baslik}</Metin>
          {mod === "antrenman" ? (
            <Cubuk oran={(oturum.n + (sonuc ? 0 : 0)) / ANTRENMAN_SORU} yukseklik={10} parilti />
          ) : mod === "tespit" && tespit ? (
            <Cubuk oran={tespit.cevaplanan / Math.max(1, tespit.toplam)} yukseklik={10} gradyan={GRADYAN.buz} />
          ) : null}
        </View>
        {ardisik >= 2 && (
          <Animated.View entering={ZoomIn.springify()} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: `${OYUN.ates}26` }}>
            <Flame size={16} color={OYUN.ates} fill={OYUN.ates} />
            <Metin tur="kucuk" renk={OYUN.ates}>{ardisik}</Metin>
          </Animated.View>
        )}
        {ekran.ad === "soru" && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: tema.yuzey }}>
            <Clock size={14} color={tema.soluk} />
            <Metin tur="kucuk" soluk>{Math.floor(gecen / 60)}:{String(gecen % 60).padStart(2, "0")}</Metin>
          </View>
        )}
      </View>

      {konfeti > 0 && <Konfeti anahtar={konfeti} />}

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140, gap: 14, maxWidth: 760, width: "100%", alignSelf: "center" }}>
        {(ekran.ad === "yukleniyor" || ekran.ad === "bekle") && (
          <Animated.View entering={FadeIn} style={{ alignItems: "center", gap: 16, paddingTop: 80 }}>
            <IkonKutu ikon={Sparkles} renk={tema.vurgu} boyut={72} />
            <ActivityIndicator color={tema.vurgu} />
            <Metin soluk ortala>{ekran.ad === "bekle" ? t("soru.hazirlaniyor") : t("soru.yukleniyor")}</Metin>
          </Animated.View>
        )}

        {ekran.ad === "bilgi" && (
          <Animated.View entering={FadeInDown} style={{ gap: 16, paddingTop: 40, alignItems: "stretch" }}>
            <View style={{ alignItems: "center" }}><IkonKutu ikon={ekran.anahtar === "ortak.hata" ? XCircle : BookOpenCheck} renk={ekran.anahtar === "ortak.hata" ? tema.yanlis : tema.vurgu} boyut={72} /></View>
            <Metin tur="altbaslik" ortala>{hata ?? t(ekran.anahtar)}</Metin>
            {oturum.n > 0 && <Metin soluk ortala>{t("soru.dogruSayisi", { dogru: oturum.dogru, toplam: oturum.n })}</Metin>}
            {ekran.anahtar === "ortak.hata" && <Dugme baslik={t("ortak.yenidenDene")} onPress={() => void getir(0)} />}
            <Dugme tur="ikincil" baslik={t("soru.kapat")} onPress={() => router.back()} />
          </Animated.View>
        )}

        {ekran.ad === "ozet" && (
          <Kart gradyan={[tema.yuzey2, tema.yuzey]}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <IkonKutu ikon={Target} renk={tema.vurgu} boyut={64} />
              <Metin tur="baslik" ortala>{t("soru.oturumOzeti")}</Metin>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { ikon: CheckCircle2, renk: tema.dogru, deger: `${oturum.dogru}/${oturum.n}`, ad: t("soru.dogruEtiket") },
                { ikon: Sparkles, renk: OYUN.xp, deger: `+${oturum.xp}`, ad: "XP" },
                { ikon: Coins, renk: OYUN.altin, deger: `+${oturum.altin}`, ad: t("oyun.altin") },
              ].map((x, i) => (
                <Animated.View key={x.ad} entering={ZoomIn.delay(150 + i * 120).springify()} style={{ flex: 1, alignItems: "center", gap: 4, padding: 12, borderRadius: 16, backgroundColor: `${x.renk}1A` }}>
                  <x.ikon size={22} color={x.renk} />
                  <Metin tur="sayi">{x.deger}</Metin>
                  <Metin tur="kucuk" soluk>{x.ad}</Metin>
                </Animated.View>
              ))}
            </View>
            <Dugme baslik={t("soru.devamEt")} onPress={() => { setOturum({ n: 0, dogru: 0, xp: 0, altin: 0 }); void getir(0); }} />
            <Dugme tur="ikincil" baslik={t("soru.bitir")} onPress={() => router.back()} />
          </Kart>
        )}

        {soru && (ekran.ad === "soru" || ekran.ad === "sonuc") && (
          <>
            <Animated.View key={soru.id} entering={FadeInDown.duration(380).springify().damping(16)} style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <Etiket metin={soru.ders} renk={tema.vurgu} />
                <Etiket metin={soru.kazanimKodu} renk={tema.soluk} />
                {sayac && <Metin tur="kucuk" soluk stil={{ marginLeft: "auto" }}>{sayac}</Metin>}
              </View>
              <View style={{ padding: 20, borderRadius: 24, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar, ...golge(2, tema.golge) }}>
                <MatematikMetni md={soru.govdeMd} renk={tema.metin} boyut={BOYUT.soruMetni} />
                {soru.aiUretimi && <Metin tur="kucuk" soluk stil={{ marginTop: 8, fontSize: 11 }}>{t("ortak.aiEtiketi")}</Metin>}
              </View>
            </Animated.View>

            <Animated.View style={[{ gap: 10 }, sarsinti.stil]} accessibilityRole="radiogroup">
              {sikHarfleri.map((h, i) => (
                <SikKarti
                  key={`${soru.id}${h}`}
                  harf={h}
                  sira={i}
                  md={soru.siklar[h] ?? ""}
                  secili={secilen === h}
                  durum={sonuc ? (sonuc.dogru === h ? "dogru" : secilen === h ? "yanlis" : "soluk") : null}
                  pasif={Boolean(sonuc) || gonderiyor}
                  onPress={() => { titret(); setSecilen(h); }}
                />
              ))}
            </Animated.View>

            {ipuclari.map((ip, i) => (
              <Animated.View key={i} entering={FadeInDown.springify()}>
                <View style={{ padding: 16, borderRadius: 18, gap: 6, backgroundColor: `${OYUN.altin}14`, borderWidth: 1, borderColor: `${OYUN.altin}55` }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Lightbulb size={18} color={OYUN.altin} />
                    <Metin tur="kucuk" renk={OYUN.altin}>{t("soru.ipucu", { n: i + 1 })}</Metin>
                  </View>
                  <MatematikMetni md={ip} renk={tema.metin} boyut={BOYUT.govde} />
                </View>
              </Animated.View>
            ))}

            {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}

            {ekran.ad === "soru" && (
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                {ipucuVar && <Dugme kucuk tur="ikincil" ikon={Lightbulb} baslik={t("soru.ipucu", { n: ipuclari.length + 1 })} onPress={() => void ipucuIste()} />}
                <Dugme kucuk tur="hayalet" ikon={SkipForward} baslik={t("soru.bosBirak")} onPress={() => void cevapla(true)} />
              </View>
            )}
            {ekran.ad === "soru" && ipucuVar && ipuclari.length === 0 && <Metin tur="kucuk" soluk>{t("soru.ipucuNot")}</Metin>}

            {sonuc && (
              <View style={{ gap: 12 }}>
                {sonuc.oyun && (sonuc.oyun.hedefTamam || sonuc.oyun.seriDurum || sonuc.oyun.tamamlananGorevler.length > 0) && (
                  <Animated.View entering={FadeInUp.delay(200).springify()} style={{ gap: 8 }}>
                    {sonuc.oyun.hedefTamam && <Bildirim ikon={Target} renk={OYUN.ates} metin={t("oyun.hedefTamam")} />}
                    {sonuc.oyun.seriDurum === "artti" && <Bildirim ikon={Flame} renk={OYUN.ates} metin={t("oyun.seriArtti", { n: sonuc.oyun.seriGun })} />}
                    {sonuc.oyun.seriDurum === "donduruldu" && <Bildirim ikon={Flame} renk={OYUN.buz} metin={t("oyun.seriDonduruldu", { n: sonuc.oyun.seriGun })} />}
                    {sonuc.oyun.seriDurum === "sifirlandi" && <Bildirim ikon={Flame} renk={tema.soluk} metin={t("oyun.seriSifirlandi")} />}
                    {sonuc.oyun.tamamlananGorevler.map((g) => (
                      <Bildirim key={g.kod} ikon={CheckCircle2} renk={tema.dogru} metin={`${t("oyun.gorevTamam", { baslik: g.baslik })} · +${g.xp} XP`} />
                    ))}
                    {sonuc.oyun.yeniRozetler.map((kod) => {
                      const rz = ROZETLER.find((x) => x.kod === kod);
                      return (
                        <View key={kod} style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: `${OYUN.xp}1A` }}>
                          <RozetMadalya kod={kod} kategori={rz?.kategori ?? "soru"} boyut={40} />
                          <Metin tur="kucuk" stil={{ flex: 1 }}>{t("oyun.yeniRozet", { ad: rz?.ad ?? kod })}</Metin>
                        </View>
                      );
                    })}
                  </Animated.View>
                )}
                {sonuc.oyun?.klan && (sonuc.oyun.klan.boss || (sonuc.oyun.klan.savas && sonuc.oyun.klan.savas.etki > 0) || sonuc.oyun.klan.tamamlananGorevler.length > 0 || sonuc.oyun.klan.seviyeAtladi) && (
                  <Animated.View entering={FadeInUp.delay(300).springify()} style={{ gap: 8 }}>
                    {sonuc.oyun.klan.boss && (
                      <View style={{ padding: 12, borderRadius: 16, gap: 8, backgroundColor: `${OYUN.boss}14`, borderWidth: 1, borderColor: `${OYUN.boss}44` }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                          <Swords size={18} color={OYUN.boss} />
                          <Metin tur="kucuk" stil={{ flex: 1 }}>
                            {sonuc.oyun.klan.boss.yenildi ? t("klan.bossYenildi", { ad: sonuc.oyun.klan.boss.ad }) : t("klan.bossHasar", { n: sonuc.oyun.klan.boss.hasar, kalan: sonuc.oyun.klan.boss.kalan_can })}
                          </Metin>
                        </View>
                        <Cubuk oran={sonuc.oyun.klan.boss.kalan_can / Math.max(1, sonuc.oyun.klan.boss.can)} gradyan={GRADYAN.boss} yukseklik={8} />
                      </View>
                    )}
                    {sonuc.oyun.klan.savas && sonuc.oyun.klan.savas.etki > 0 && (
                      <Bildirim ikon={Shield} renk={tema.vurgu} metin={t("klan.savasEtki", { n: Math.round(sonuc.oyun.klan.savas.etki), hak: sonuc.oyun.klan.savas.hak_kalan })} />
                    )}
                    {sonuc.oyun.klan.tamamlananGorevler.map((g) => (
                      <Bildirim key={g} ikon={CheckCircle2} renk={tema.dogru} metin={t(`klan.gorev_${g === "toplam_soru" ? "toplam_soru" : "herkes_30"}`, { hedef: "" })} />
                    ))}
                    {sonuc.oyun.klan.seviyeAtladi && <Bildirim ikon={Sparkles} renk={OYUN.xp} metin={t("klan.seviyeAtladi", { n: sonuc.oyun.klan.seviye })} />}
                  </Animated.View>
                )}
                {sonuc.celdiriciNotu && secilen && (
                  <Kart vurgu={tema.yanlis}>
                    <Metin tur="altbaslik">{t("soru.neden", { sik: secilen })}</Metin>
                    <MatematikMetni md={sonuc.celdiriciNotu} renk={tema.metin} boyut={BOYUT.govde} />
                  </Kart>
                )}
                {sonuc.cozumAdimlari.length > 0 && (
                  <Kart vurgu={tema.vurgu} sira={1}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <BookOpenCheck size={20} color={tema.vurgu} />
                      <Metin tur="altbaslik">{t("soru.cozum")}</Metin>
                    </View>
                    {sonuc.cozumAdimlari.map((a, i) => (
                      <View key={i} style={{ flexDirection: "row", gap: 10 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: `${tema.vurgu}26` }}>
                          <Metin tur="kucuk" renk={tema.vurgu}>{i + 1}</Metin>
                        </View>
                        <View style={{ flex: 1 }}><MatematikMetni md={a} renk={tema.metin} boyut={BOYUT.govde} /></View>
                      </View>
                    ))}
                  </Kart>
                )}
                {sonuc.sayilmadi && <Metin tur="kucuk" soluk>{t("soru.hizliCevap")}</Metin>}
                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                  <Dugme kucuk tur="hayalet" ikon={Flag} baslik={bildirildi ? t("soru.hataBildirildi") : t("soru.hataBildir")} onPress={() => void hataBildir()} />
                  {(mod === "antrenman" || mod === "tekrar" || mod === "tespit") && asistanAcik && (
                    <Dugme kucuk tur="ikincil" ikon={Sparkles} baslik={t("asistan.sor")} onPress={() => router.push({ pathname: "/asistan", params: { soruId: soru.id } })} />
                  )}
                  {sonuc.oyun?.klan && (
                    <Dugme kucuk tur="hayalet" ikon={MessageCircleQuestion} baslik={klanaSoruldu === soru.id ? t("soru.klanaSoruldu") : t("soru.klanaSor")} onPress={() => void klanaSor()} />
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Alt eylem alanı: soru sırasında "Cevapla", sonuçta renkli sonuç paneli */}
      {soru && ekran.ad === "soru" && (
        <Animated.View entering={FadeInUp} style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 24, backgroundColor: `${tema.zemin}EE` }}>
          <View style={{ maxWidth: 728, width: "100%", alignSelf: "center" }}>
            <Dugme buyuk ikon={Check} baslik={t("soru.cevapla")} onPress={() => void cevapla(false)} yukleniyor={gonderiyor} pasif={!secilen} />
          </View>
        </Animated.View>
      )}
      {sonuc && (
        <Animated.View entering={SlideInDown.springify().damping(15)} style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
          <LinearGradient colors={sonuc.sonuc === "dogru" ? GRADYAN.dogru : sonuc.sonuc === "bos" ? ["#6A6788", "#45425E"] : GRADYAN.yanlis} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18, paddingBottom: 26, ...golge(3, "#000") }}>
            <View style={{ maxWidth: 728, width: "100%", alignSelf: "center", gap: 12 }}>
              <UcanOdul key={soru?.id} xp={sonuc.xp} altin={sonuc.altin} />
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Animated.View entering={ZoomIn.delay(120).springify().damping(8)} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#ffffff33", alignItems: "center", justifyContent: "center" }}>
                  {sonuc.sonuc === "dogru" ? <Check size={30} color="#fff" strokeWidth={3.5} /> : <X size={30} color="#fff" strokeWidth={3.5} />}
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <Metin tur="baslik" renk="#fff">{sonuc.sonuc === "dogru" ? t(DOGRU_SOZLER[(oturum.n + ardisik) % DOGRU_SOZLER.length] ?? "soru.dogru") : sonuc.sonuc === "bos" ? t("soru.bos") : t("soru.yanlis")}</Metin>
                  {sonuc.sonuc !== "dogru" ? (
                    <Metin renk="#ffffffdd">{t("soru.dogruCevap", { sik: sonuc.dogru })}</Metin>
                  ) : sonuc.hataDefteri === "temizlendi" ? (
                    <Metin renk="#ffffffdd">{t("soru.temizlendi")}</Metin>
                  ) : (
                    <Metin renk="#ffffffdd">{t("soru.dogruAlt")}</Metin>
                  )}
                </View>
              </View>
              <Basilabilir onPress={sonraki} etiket={t("soru.sonraki")}>
                <View style={{ minHeight: 56, borderRadius: 28, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
                  <Metin tur="altbaslik" renk={sonuc.sonuc === "dogru" ? "#0E8F55" : "#C42640"}>{sonuc.tespitBitti ? t("soru.bitir") : t("soru.sonraki")}</Metin>
                </View>
              </Basilabilir>
            </View>
          </LinearGradient>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const DOGRU_SOZLER = ["soru.dogru", "soru.dogru2", "soru.dogru3", "soru.dogru4"] as const;

function Bildirim({ ikon: Ikon, renk, metin }: { ikon: typeof Check; renk: string; metin: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: `${renk}1A`, borderWidth: 1, borderColor: `${renk}44` }}>
      <Ikon size={20} color={renk} />
      <Metin tur="kucuk" stil={{ flex: 1 }}>{metin}</Metin>
    </View>
  );
}

