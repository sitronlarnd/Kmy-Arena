import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Alan } from "@/bilesenler/Alan";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { api, ApiHatasi } from "@/lib/api";
import { useOyun } from "@/lib/oyun";
import { useMufredat } from "@/lib/sorgular";
import { BOYUT, useTema } from "@/lib/tema";

interface Gecmis {
  id: string;
  mod: string;
  durum: string;
  skorBen: number;
  skorRakip: number;
  sonuc: "kazandi" | "kaybetti" | "berabere" | null;
  kupa: number;
  davetKodu: string | null;
}

const ROBOT_ONERI_SN = 25;

export default function DuelloMerkezi() {
  const tema = useTema();
  const dersler = useMufredat().data ?? [];
  const oyun = useOyun().data;
  const [dersKodu, setDersKodu] = useState<string | null>(null);
  const [araniyor, setAraniyor] = useState(false);
  const [bekleme, setBekleme] = useState(0);
  const [kod, setKod] = useState("");
  const [takmaAd, setTakmaAd] = useState("");
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setInterval> | null>(null);
  const gecmis = useQuery({ queryKey: ["duello-gecmis"], queryFn: () => api<Gecmis[]>("/api/duello/gecmis", {}) });

  const hataGoster = (h: unknown) => setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
  const dersParam = dersKodu ? { dersKodu } : {};

  const durdur = () => {
    if (zamanlayici.current) clearInterval(zamanlayici.current);
    zamanlayici.current = null;
    setAraniyor(false);
  };
  useEffect(() => () => durdur(), []);

  const dereceli = () => {
    setHata(null);
    setAraniyor(true);
    setBekleme(0);
    const dene = async () => {
      try {
        const y = await api<{ durum: "eslesti"; duelloId: string } | { durum: "bekliyor"; bekleme: number }>("/api/duello/kuyruk", dersParam);
        if (y.durum === "eslesti") {
          durdur();
          router.push(`/duello/${y.duelloId}`);
        } else setBekleme(y.bekleme);
      } catch (h) {
        durdur();
        hataGoster(h);
      }
    };
    void dene();
    zamanlayici.current = setInterval(() => void dene(), 2000);
  };

  const vazgec = () => {
    durdur();
    void api("/api/duello/kuyruktan-cik", {}).catch(() => undefined);
  };

  const calistir = async (anahtar: string, yol: string, govde: unknown) => {
    setMesgul(anahtar);
    setHata(null);
    try {
      if (araniyor) vazgec();
      const y = await api<{ duelloId: string }>(yol, govde);
      router.push(`/duello/${y.duelloId}`);
    } catch (h) {
      hataGoster(h);
    } finally {
      setMesgul(null);
    }
  };

  return (
    <Ekran baslik={t("duello.baslik")}>
      <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("duello.aciklama")}</Text>
      {oyun && <Text style={{ color: tema.metin, fontWeight: "700" }}>🏆 {t("duello.kupa", { n: oyun.kupa })}</Text>}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityLabel={t("duello.ders")}>
        <Pressable onPress={() => setDersKodu(null)} style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: dersKodu === null ? tema.vurgu : tema.kenar, backgroundColor: dersKodu === null ? tema.vurgu : tema.yuzey }}>
          <Text style={{ color: dersKodu === null ? "#fff" : tema.metin }}>{t("duello.sirali")}</Text>
        </Pressable>
        {dersler.map((d) => (
          <Pressable key={d.id} onPress={() => setDersKodu(d.kod)} style={{ minHeight: 40, paddingHorizontal: 12, justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: dersKodu === d.kod ? tema.vurgu : tema.kenar, backgroundColor: dersKodu === d.kod ? tema.vurgu : tema.yuzey }}>
            <Text style={{ color: dersKodu === d.kod ? "#fff" : tema.metin }}>{d.ad}</Text>
          </Pressable>
        ))}
      </View>

      {hata && <Text style={{ color: tema.yanlis }}>{hata}</Text>}

      <Kart>
        <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 17 }}>⚔️ {t("duello.dereceli")}</Text>
        <Text style={{ color: tema.soluk }}>{t("duello.derecelAciklama")}</Text>
        {araniyor ? (
          <>
            <Text style={{ color: tema.metin }}>{t("duello.araniyor", { sn: bekleme })}</Text>
            {bekleme >= ROBOT_ONERI_SN && (
              <>
                <Text style={{ color: tema.soluk }}>{t("duello.robotOner")}</Text>
                <Dugme baslik={`🤖 ${t("duello.robot")}`} yukleniyor={mesgul === "robot"} onPress={() => void calistir("robot", "/api/duello/robot", dersParam)} />
              </>
            )}
            <Dugme ikincil baslik={t("duello.vazgec")} onPress={vazgec} />
          </>
        ) : (
          <Dugme buyuk baslik={t("duello.dereceli")} onPress={dereceli} />
        )}
      </Kart>

      <Kart>
        <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 17 }}>🤝 {t("duello.davet")}</Text>
        <Text style={{ color: tema.soluk }}>{t("duello.davetAciklama")}</Text>
        <Dugme baslik={t("duello.davet")} yukleniyor={mesgul === "davet"} onPress={() => void calistir("davet", "/api/duello/davet", dersParam)} />
        <Alan etiket={t("duello.kodEtiket")} value={kod} onChangeText={(x) => setKod(x.toUpperCase())} autoCapitalize="characters" maxLength={6} />
        <Dugme ikincil baslik={t("duello.katil")} yukleniyor={mesgul === "katil"} pasif={kod.length !== 6} onPress={() => void calistir("katil", "/api/duello/katil", { kod })} />
      </Kart>

      <Kart>
        <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 17 }}>⏳ {t("duello.asenkron")}</Text>
        <Text style={{ color: tema.soluk }}>{t("duello.asenkronAciklama")}</Text>
        <Alan etiket={t("duello.takmaAdEtiket")} value={takmaAd} onChangeText={setTakmaAd} autoCapitalize="none" />
        <Dugme baslik={t("duello.gonder")} yukleniyor={mesgul === "asenkron"} pasif={takmaAd.trim().length < 3} onPress={() => void calistir("asenkron", "/api/duello/asenkron", { takmaAd, ...dersParam })} />
      </Kart>

      <Kart>
        <Text style={{ color: tema.metin, fontWeight: "800", fontSize: 17 }}>🤖 {t("duello.robot")}</Text>
        <Text style={{ color: tema.soluk }}>{t("duello.robotAciklama")}</Text>
        <Dugme ikincil baslik={t("duello.robot")} yukleniyor={mesgul === "robot"} onPress={() => void calistir("robot", "/api/duello/robot", dersParam)} />
      </Kart>

      {(gecmis.data ?? []).length > 0 && (
        <Kart>
          <Text style={{ color: tema.metin, fontWeight: "800" }}>{t("duello.gecmis")}</Text>
          {(gecmis.data ?? []).map((g) => (
            <Pressable key={g.id} onPress={() => router.push(`/duello/${g.id}`)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: tema.metin }}>
                {g.sonuc === "kazandi" ? "🏆" : g.sonuc === "kaybetti" ? "➖" : g.durum === "bitti" ? "🤝" : "⏳"} {t(`duello.${g.mod === "dereceli" ? "dereceli" : g.mod === "robot" ? "robot" : g.mod === "asenkron" ? "asenkron" : "davet"}`)}
              </Text>
              <Text style={{ color: tema.soluk }}>{g.skorBen}–{g.skorRakip}{g.kupa ? ` · ${g.kupa > 0 ? "+" : ""}${g.kupa}` : ""}</Text>
            </Pressable>
          ))}
        </Kart>
      )}
    </Ekran>
  );
}
