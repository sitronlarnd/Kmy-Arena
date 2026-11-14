import { SIKLAR, type Sik } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import { KeyRound, Radio, Trophy } from "lucide-react-native";
import { Alan } from "@/bilesenler/Alan";
import { SikKarti } from "@/bilesenler/SikKarti";
import { Bolum, Dugme, Etiket, Halka, Kart, Metin, Nabiz, titret } from "@/bilesenler/ui";
import { Ekran } from "@/bilesenler/Ekran";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { api, ApiHatasi } from "@/lib/api";
import { olculenRtt, saatGuncelle, sunucuSimdi } from "@/lib/saat";
import { BOYUT, GRADYAN, OYUN, useTema, yazi } from "@/lib/tema";

interface CanliSoru {
  sira: number;
  acilis: string;
  soru: { govde_md: string; siklar: Partial<Record<Sik, string>> } | null;
  dogru: Sik | null;
  ben: { secilen: Sik | null; dogru: boolean; derece: number | null } | null;
  ilk10: Array<{ takma_ad: string; sure_ms: number }> | null;
}
interface Durum {
  durum: "kapali" | "yakinda" | "aktif";
  ad?: string | null;
  baslangic?: string;
  sunucu_zamani?: number;
  oturum?: { id: string; baslangic: string; sure_sn: number; aralik_sn: number; sunucu_zamani: number; sorular: CanliSoru[]; subeler: Array<{ sube: string; dogru: number; katilimci: number }> | null };
}

export default function Canli() {
  const tema = useTema();
  const [d, setD] = useState<Durum | null>(null);
  const [simdi, setSimdi] = useState(sunucuSimdi());
  const [hata, setHata] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  // Öğretmenin başlattığı sınıf yarışması (PIN ile) ya da günlük Canlı Soru Saati
  const { oturum: sinifOturumu } = useLocalSearchParams<{ oturum?: string }>();

  const pinleKatil = async () => {
    setHata(null);
    try {
      const r = await api<{ oturum: string }>("/api/canli/pin", { pin: pin.trim() });
      router.replace({ pathname: "/canli", params: { oturum: r.oturum } });
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  };

  const yenile = useCallback(async () => {
    const t0 = Date.now();
    try {
      const y = sinifOturumu ? await api<Durum>("/api/canli/oturum", { oturum: sinifOturumu }) : await api<Durum>("/api/canli/durum", {});
      const sz = y.oturum?.sunucu_zamani ?? y.sunucu_zamani;
      if (sz) saatGuncelle(sz, t0, Date.now());
      setD(y);
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  }, [sinifOturumu]);

  useEffect(() => {
    void yenile();
    const i = setInterval(() => void yenile(), sinifOturumu ? 1500 : 3000);
    const s = setInterval(() => setSimdi(sunucuSimdi()), 200);
    return () => {
      clearInterval(i);
      clearInterval(s);
    };
  }, [yenile]);

  const o = d?.oturum;
  const aktifSoru = o?.sorular.find((s) => {
    const a = Date.parse(s.acilis);
    return simdi >= a && simdi <= a + o.sure_sn * 1000;
  });
  const siradaki = o?.sorular.find((s) => Date.parse(s.acilis) > simdi);
  const bitti = o && !aktifSoru && !siradaki;

  const cevapla = async (sik: Sik) => {
    if (!o || !aktifSoru) return;
    try {
      await api("/api/canli/cevap", { oturum: o.id, sira: aktifSoru.sira, secilen: sik, rttMs: olculenRtt() });
      await yenile();
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  };

  const kalanSn = aktifSoru && o ? Math.max(0, Math.ceil((Date.parse(aktifSoru.acilis) + o.sure_sn * 1000 - simdi) / 1000)) : 0;
  const bekleSn = siradaki ? Math.max(0, Math.ceil((Date.parse(siradaki.acilis) - simdi) / 1000)) : 0;

  return (
    <Ekran baslik={sinifOturumu ? (d?.ad ?? t("canli.sinifBaslik")) : t("canli.baslik")} altBaslik={sinifOturumu ? t("canli.sinifAciklama") : t("canli.aciklama")}>
      <Stack.Screen options={{ headerShown: false }} />
      {!sinifOturumu && (
        <Kart>
          <Metin tur="altbaslik">{t("canli.pinBaslik")}</Metin>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
            <View style={{ flex: 1 }}><Alan etiket={t("canli.pinEtiket")} value={pin} onChangeText={(x) => setPin(x.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" /></View>
            <Dugme kucuk genis={false} ikon={KeyRound} baslik={t("canli.katil")} onPress={() => void pinleKatil()} />
          </View>
        </Kart>
      )}
      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
      {d?.durum === "kapali" && <Kart><Metin soluk ortala>{t("canli.kapali")}</Metin></Kart>}
      {d?.durum === "yakinda" && d.baslangic && (
        <Kart gradyan={GRADYAN.ates}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Nabiz><Radio size={32} color="#fff" /></Nabiz>
            <Metin tur="altbaslik" renk="#fff" stil={{ flex: 1 }}>{t("canli.yakinda", { zaman: new Date(d.baslangic).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) })}</Metin>
          </View>
        </Kart>
      )}

      {o && !aktifSoru && siradaki && (
        <View style={{ alignItems: "center", paddingVertical: 20, gap: 6 }}>
          <Metin soluk>{siradaki.sira === 1 ? t("canli.basliyorKisa") : t("canli.bekleKisa")}</Metin>
          <Animated.Text key={bekleSn} entering={ZoomIn.springify().damping(8)} style={[yazi("siyah"), { color: OYUN.ates, fontSize: 88 }]}>{bekleSn}</Animated.Text>
        </View>
      )}

      {o && aktifSoru?.soru && (
        <Animated.View key={aktifSoru.sira} entering={FadeIn} style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Halka oran={kalanSn / Math.max(1, o.sure_sn)} boyut={56} kalinlik={6} gradyan={kalanSn <= 10 ? GRADYAN.yanlis : GRADYAN.ates}>
              <Metin tur="altbaslik">{kalanSn}</Metin>
            </Halka>
            <Metin tur="altbaslik" stil={{ flex: 1 }}>{t("canli.soru", { n: aktifSoru.sira })}</Metin>
            <Etiket metin="CANLI" renk={OYUN.ates} ikon={Radio} />
          </View>
          <View style={{ padding: 20, borderRadius: 24, backgroundColor: tema.yuzey, borderWidth: 1, borderColor: tema.kenar }}>
            <MatematikMetni md={aktifSoru.soru.govde_md} renk={tema.metin} boyut={BOYUT.soruMetni} />
          </View>
          {aktifSoru.ben ? (
            <Kart gradyan={aktifSoru.ben.dogru ? GRADYAN.dogru : GRADYAN.yanlis}>
              <Metin tur="altbaslik" renk="#fff" ortala>
                {aktifSoru.ben.dogru ? (aktifSoru.ben.derece && aktifSoru.ben.derece <= 10 ? t("canli.bonus") : t("canli.derece", { n: aktifSoru.ben.derece ?? 0 })) : t("canli.yanlis")}
              </Metin>
            </Kart>
          ) : (
            <View style={{ gap: 10 }}>
              {SIKLAR.filter((h) => aktifSoru.soru?.siklar[h] !== undefined).map((h, i) => (
                <SikKarti key={`${aktifSoru.sira}${h}`} harf={h} sira={i} md={aktifSoru.soru?.siklar[h] ?? ""} secili={false} durum={null} pasif={false} onPress={() => { titret("orta"); void cevapla(h); }} />
              ))}
            </View>
          )}
        </Animated.View>
      )}

      {o && o.sorular.some((s) => s.dogru) && (
        <Kart>
          <Bolum baslik={t("canli.sonuc")} ikon={Trophy} />
          {o.sorular.filter((s) => s.dogru).map((s) => (
            <View key={s.sira} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Metin stil={{ flex: 1 }}>{t("canli.soru", { n: s.sira })}</Metin>
                <Etiket metin={s.dogru ?? ""} renk={tema.dogru} />
                {s.ben && <Etiket metin={s.ben.dogru ? t("canli.dogruKisa") : t("canli.yanlisKisa")} renk={s.ben.dogru ? tema.dogru : tema.yanlis} />}
              </View>
              {s.ilk10 && <Metin tur="kucuk" soluk>{t("canli.ilk10")}: {s.ilk10.map((x) => x.takma_ad).join(", ")}</Metin>}
            </View>
          ))}
          {bitti && (o.subeler ?? []).length > 0 && (
            <>
              <Bolum baslik={t("canli.subeSiralama")} ikon={Trophy} />
              {(o.subeler ?? []).map((s, i) => (
                <View key={s.sube} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Metin tur="altbaslik" renk={i === 0 ? OYUN.altin : tema.soluk} stil={{ width: 24 }}>{i + 1}</Metin>
                  <Metin stil={{ flex: 1 }}>{s.sube}</Metin>
                  <Metin tur="kucuk" soluk>{t("canli.dogruSayisi", { n: s.dogru, k: s.katilimci })}</Metin>
                </View>
              ))}
            </>
          )}
        </Kart>
      )}
    </Ekran>
  );
}
