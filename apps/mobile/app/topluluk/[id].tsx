import { SIKLAR, type Sik } from "@kmy/shared";
import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { Bot, Check, CheckCircle2, Flag, GraduationCap, Lightbulb, Send, Sparkles, Star } from "lucide-react-native";
import { useState } from "react";
import { Image, Pressable, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Konfeti, RozetKutlama } from "@/bilesenler/Kutlama";
import { Ekran } from "@/bilesenler/Ekran";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { Basilabilir, Dugme, Etiket, Kart, Metin, titret } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { useOyunYenile } from "@/lib/oyun";
import { ne_zaman } from "@/lib/topluluk";
import { BOYUT, OYUN, useTema, yazi } from "@/lib/tema";

interface Cevap {
  id: string; sik: Sik | null; aciklama: string; gorsel_url: string | null; olusturma: string; cevaplayan: string; benim: boolean;
  ai_durum: "bekliyor" | "tamam" | "hata"; ai_dogru: boolean | null; ai_aciklama_yeterli: boolean | null;
  kabul: "soran" | "ogretmen" | null; ornek_cozum: boolean; xp: number; mentor: boolean;
}
interface Detay {
  id: string; metin: string; gorsel_url: string | null; durum: "acik" | "cozuldu" | "gizli"; olusturma: string; benim: boolean;
  soran: string; ders: string; kazanim: { kod: string; aciklama: string } | null; ai_ipucu: string | null; ai_cozum: string | null; cevaplar: Cevap[];
}

export default function ToplulukDetay() {
  const tema = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const oyunYenile = useOyunYenile();
  const q = useQuery({ queryKey: ["topluluk-detay", id], queryFn: () => api<Detay>("/api/topluluk/detay", { soruId: id }), refetchInterval: 15_000 });
  const d = q.data;
  const [sik, setSik] = useState<Sik | null>(null);
  const [aciklama, setAciklama] = useState("");
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState<string | null>(null);
  const [konfeti, setKonfeti] = useState(0);
  const [rozetler, setRozetler] = useState<string[]>([]);

  const yap = async (anahtar: string, yol: string, govde: unknown, sonra?: (y: never) => void) => {
    setMesgul(anahtar);
    setHata(null);
    setBilgi(null);
    try {
      const y = await api<never>(yol, govde);
      sonra?.(y);
      await qc.invalidateQueries({ queryKey: ["topluluk-detay", id] });
      void qc.invalidateQueries({ queryKey: ["topluluk"] });
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    } finally {
      setMesgul(null);
    }
  };

  const cevapVerildi = d?.cevaplar.some((c) => c.benim);

  return (
    <Ekran baslik={t("topluluk.baslik")} baslikGizli={!d}>
      <Stack.Screen options={{ headerShown: false }} />
      <RozetKutlama kodlar={rozetler} kapat={() => setRozetler((l) => l.slice(1))} />
      {konfeti > 0 && <Konfeti anahtar={konfeti} />}
      {!d && <Metin soluk>{q.isError ? t("topluluk.bulunamadi") : t("ortak.yukleniyor")}</Metin>}
      {d && (
        <>
          <Kart vurgu={d.durum === "cozuldu" ? tema.dogru : OYUN.elmas}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Etiket metin={d.ders} renk={OYUN.elmas} />
              {d.kazanim && <Etiket metin={d.kazanim.kod} renk={tema.soluk} />}
              {d.durum === "cozuldu" && <Etiket metin={t("topluluk.cozuldu")} renk={tema.dogru} ikon={CheckCircle2} />}
              <Metin tur="kucuk" soluk stil={{ marginLeft: "auto" }}>{d.benim ? "Sen" : d.soran} · {ne_zaman(d.olusturma)}</Metin>
            </View>
            <MatematikMetni md={d.metin} renk={tema.metin} boyut={BOYUT.soruMetni} />
            {d.gorsel_url && <Image source={{ uri: d.gorsel_url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 14 }} resizeMode="contain" accessibilityLabel={t("fotograf.okunanSoru")} />}
            {!d.benim && (
              <Pressable onPress={() => void yap("sk", "/api/topluluk/sikayet", { hedefTur: "topluluk_soru", hedefId: d.id, sebep: "uygunsuz" }, () => setBilgi(t("topluluk.sikayetEdildi")))} accessibilityRole="button">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Flag size={12} color={tema.soluk} />
                  <Metin tur="kucuk" soluk stil={{ fontSize: 11 }}>{t("topluluk.sikayet")}</Metin>
                </View>
              </Pressable>
            )}
          </Kart>

          {d.ai_ipucu && (
            <Kart vurgu={OYUN.altin}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Lightbulb size={18} color={OYUN.altin} />
                <Metin tur="kucuk" renk={OYUN.altin}>{t("topluluk.aiIpucu")}</Metin>
              </View>
              <MatematikMetni md={d.ai_ipucu} renk={tema.metin} boyut={BOYUT.govde} />
            </Kart>
          )}
          {d.ai_cozum && (
            <Kart vurgu={tema.vurgu}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Bot size={18} color={tema.vurgu} />
                <Metin tur="kucuk" renk={tema.vurgu}>{t("topluluk.aiCozum")}</Metin>
              </View>
              <MatematikMetni md={d.ai_cozum} renk={tema.metin} boyut={BOYUT.govde} />
            </Kart>
          )}

          {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
          {bilgi && <Metin renk={tema.dogru}>{bilgi}</Metin>}

          {d.cevaplar.map((c, i) => (
            <Kart key={c.id} sira={i} vurgu={c.kabul ? tema.dogru : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <Metin tur="altbaslik" stil={{ fontSize: 15 }}>{c.benim ? "Sen" : c.cevaplayan}</Metin>
                {c.mentor && <Etiket metin={t("topluluk.mentor")} renk={OYUN.altin} ikon={GraduationCap} />}
                {c.sik && <Etiket metin={c.sik} renk={tema.vurgu} />}
                <Metin tur="kucuk" soluk stil={{ marginLeft: "auto" }}>{ne_zaman(c.olusturma)}</Metin>
              </View>
              <MatematikMetni md={c.aciklama} renk={tema.metin} boyut={BOYUT.govde} />
              {c.gorsel_url && <Image source={{ uri: c.gorsel_url }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 14 }} resizeMode="contain" accessibilityLabel="cevap görseli" />}
              <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                {c.ai_durum === "bekliyor" && <Etiket metin={t("topluluk.ai_bekliyor")} renk={tema.soluk} ikon={Sparkles} />}
                {c.ai_durum === "tamam" && c.ai_dogru !== null && (
                  <Etiket metin={c.ai_dogru ? t("topluluk.ai_dogru") : t("topluluk.ai_yanlis")} renk={c.ai_dogru ? tema.dogru : OYUN.ates} ikon={Sparkles} />
                )}
                {c.ai_durum === "tamam" && c.ai_aciklama_yeterli === false && <Etiket metin={t("topluluk.ai_aciklamaZayif")} renk={tema.soluk} />}
                {c.kabul && (
                  <Animated.View entering={ZoomIn.springify()}>
                    <Etiket metin={c.kabul === "ogretmen" ? t("topluluk.ogretmenOnayi") : t("topluluk.kabulEdildi")} renk={tema.dogru} ikon={Check} />
                  </Animated.View>
                )}
                {c.ornek_cozum && <Etiket metin={t("topluluk.ornekCozum")} renk={OYUN.altin} ikon={Star} />}
                {c.xp > 0 && <Etiket metin={`+${c.xp} XP`} renk={OYUN.xp} />}
              </View>
              {d.benim && !c.kabul && d.durum === "acik" && (
                <Dugme kucuk tur="dogru" ikon={CheckCircle2} baslik={t("topluluk.kabulEt")} yukleniyor={mesgul === c.id}
                  onPress={() => void yap(c.id, "/api/topluluk/kabul", { cevapId: c.id }, (y: { yeniRozetler?: string[] }) => {
                    titret("basari");
                    setKonfeti((k) => k + 1);
                    oyunYenile();
                    if (y.yeniRozetler?.length) setRozetler(y.yeniRozetler);
                  })} />
              )}
              {!c.benim && (
                <Pressable onPress={() => void yap("sk", "/api/topluluk/sikayet", { hedefTur: "topluluk_cevap", hedefId: c.id, sebep: "uygunsuz" }, () => setBilgi(t("topluluk.sikayetEdildi")))} accessibilityRole="button">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Flag size={12} color={tema.soluk} />
                    <Metin tur="kucuk" soluk stil={{ fontSize: 11 }}>{t("topluluk.sikayet")}</Metin>
                  </View>
                </Pressable>
              )}
            </Kart>
          ))}

          {!d.benim && d.durum === "acik" && !cevapVerildi && (
            <Kart vurgu={tema.vurgu}>
              <Metin tur="altbaslik">{t("topluluk.cevapla")}</Metin>
              <Metin tur="etiket" soluk>{t("topluluk.sik")}</Metin>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {SIKLAR.slice(0, 5).map((h) => (
                  <Basilabilir key={h} onPress={() => setSik(sik === h ? null : h)} secili={sik === h} etiket={h}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: sik === h ? tema.vurgu : tema.kenar, backgroundColor: sik === h ? tema.vurgu : tema.yuzey2 }}>
                      <Metin tur="altbaslik" renk={sik === h ? "#fff" : tema.metin}>{h}</Metin>
                    </View>
                  </Basilabilir>
                ))}
              </View>
              <TextInput
                value={aciklama}
                onChangeText={setAciklama}
                multiline
                maxLength={2000}
                placeholder={t("topluluk.cevapYaz")}
                placeholderTextColor={tema.soluk}
                accessibilityLabel={t("topluluk.cevapYaz")}
                style={[yazi("kalin"), { minHeight: 110, textAlignVertical: "top", borderWidth: 2, borderColor: tema.kenar, borderRadius: 16, padding: 14, color: tema.metin, backgroundColor: tema.yuzey2, fontSize: BOYUT.govde }]}
              />
              <Dugme ikon={Send} baslik={t("topluluk.gonder")} yukleniyor={mesgul === "cevap"} pasif={aciklama.trim().length < 10}
                onPress={() => void yap("cevap", "/api/topluluk/cevapla", { soruId: d.id, sik, aciklama }, () => { setAciklama(""); setBilgi(t("topluluk.cevapGonderildi")); })} />
            </Kart>
          )}
        </>
      )}
    </Ekran>
  );
}
