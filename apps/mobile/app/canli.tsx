import { SIKLAR, type Sik } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { api, ApiHatasi } from "@/lib/api";
import { olculenRtt, saatGuncelle, sunucuSimdi } from "@/lib/saat";
import { BOYUT, useTema } from "@/lib/tema";

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
  baslangic?: string;
  sunucu_zamani?: number;
  oturum?: { id: string; baslangic: string; sure_sn: number; aralik_sn: number; sunucu_zamani: number; sorular: CanliSoru[]; subeler: Array<{ sube: string; dogru: number; katilimci: number }> | null };
}

export default function Canli() {
  const tema = useTema();
  const [d, setD] = useState<Durum | null>(null);
  const [simdi, setSimdi] = useState(sunucuSimdi());
  const [hata, setHata] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    const t0 = Date.now();
    try {
      const y = await api<Durum>("/api/canli/durum", {});
      const sz = y.oturum?.sunucu_zamani ?? y.sunucu_zamani;
      if (sz) saatGuncelle(sz, t0, Date.now());
      setD(y);
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    }
  }, []);

  useEffect(() => {
    void yenile();
    const i = setInterval(() => void yenile(), 3000);
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

  return (
    <Ekran baslik={t("canli.baslik")}>
      <Stack.Screen options={{ headerShown: true, title: t("canli.baslik"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      <Text style={{ color: tema.soluk }}>{t("canli.aciklama")}</Text>
      {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}
      {d?.durum === "kapali" && <Text style={{ color: tema.metin }}>{t("canli.kapali")}</Text>}
      {d?.durum === "yakinda" && d.baslangic && <Text style={{ color: tema.metin, fontSize: 18 }}>{t("canli.yakinda", { zaman: new Date(d.baslangic).toLocaleString("tr-TR", { weekday: "long", hour: "2-digit", minute: "2-digit" }) })}</Text>}

      {o && !aktifSoru && siradaki && (
        <Kart>
          <Text style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>
            {siradaki.sira === 1 ? t("canli.basliyor", { sn: Math.ceil((Date.parse(siradaki.acilis) - simdi) / 1000) }) : t("canli.bekle", { sn: Math.ceil((Date.parse(siradaki.acilis) - simdi) / 1000) })}
          </Text>
        </Kart>
      )}

      {o && aktifSoru?.soru && (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: tema.soluk }}>{t("canli.soru", { n: aktifSoru.sira })}</Text>
            <Text style={{ color: tema.metin, fontWeight: "800" }}>{Math.max(0, Math.ceil((Date.parse(aktifSoru.acilis) + o.sure_sn * 1000 - simdi) / 1000))}</Text>
          </View>
          <Kart><MatematikMetni md={aktifSoru.soru.govde_md} renk={tema.metin} boyut={BOYUT.soruMetni} /></Kart>
          {aktifSoru.ben ? (
            <Text style={{ color: aktifSoru.ben.dogru ? tema.dogru : tema.yanlis, fontWeight: "700" }}>
              {aktifSoru.ben.dogru ? (aktifSoru.ben.derece && aktifSoru.ben.derece <= 10 ? t("canli.bonus") : t("canli.derece", { n: aktifSoru.ben.derece ?? 0 })) : t("canli.yanlis")}
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {SIKLAR.filter((h) => aktifSoru.soru?.siklar[h] !== undefined).map((h) => (
                <Pressable key={h} onPress={() => void cevapla(h)} accessibilityRole="button" style={{ flexDirection: "row", gap: 12, minHeight: 52, padding: 12, alignItems: "center", borderRadius: BOYUT.yaricap, borderWidth: 2, borderColor: tema.kenar, backgroundColor: tema.yuzey }}>
                  <Text style={{ fontWeight: "800", color: tema.metin, width: 22 }}>{h}</Text>
                  <View style={{ flex: 1 }}><MatematikMetni md={aktifSoru.soru?.siklar[h] ?? ""} renk={tema.metin} boyut={BOYUT.govde} /></View>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {o && (
        <Kart>
          <Text style={{ color: tema.metin, fontWeight: "800" }}>{t("canli.sonuc")}</Text>
          {o.sorular.filter((s) => s.dogru).map((s) => (
            <View key={s.sira} style={{ gap: 2 }}>
              <Text style={{ color: tema.metin }}>{t("canli.soru", { n: s.sira })} · {s.dogru} {s.ben ? (s.ben.dogru ? t("canli.dogruKisa") : t("canli.yanlisKisa")) : ""}</Text>
              {s.ilk10 && <Text style={{ color: tema.soluk, fontSize: 12 }}>{t("canli.ilk10")}: {s.ilk10.map((x) => x.takma_ad).join(", ")}</Text>}
            </View>
          ))}
          {bitti && (o.subeler ?? []).length > 0 && (
            <>
              <Text style={{ color: tema.metin, fontWeight: "700", marginTop: 8 }}>{t("canli.subeSiralama")}</Text>
              {(o.subeler ?? []).map((s, i) => (
                <Text key={s.sube} style={{ color: tema.metin }}>{i + 1}. {s.sube} — {t("canli.dogruSayisi", { n: s.dogru, k: s.katilimci })}</Text>
              ))}
            </>
          )}
        </Kart>
      )}
    </Ekran>
  );
}
