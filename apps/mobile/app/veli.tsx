import { ROZETLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { CalendarCheck, Clock, Flame, LogOut, Sprout, Star, Target } from "lucide-react-native";
import { View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { Ekran } from "@/bilesenler/Ekran";
import { RozetMadalya } from "@/bilesenler/sanat";
import { Bolum, Cubuk, Dugme, Etiket, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { supabase } from "@/lib/supabase";
import { GRADYAN, OYUN, useTema } from "@/lib/tema";

interface Cocuk {
  id: string; ad: string; takma_ad: string | null; hafta_dk: number | null; hafta_soru: number; dogruluk: number | null;
  gunler: Array<{ gun: string; soru: number }>; guclu: string[]; gelisecek: string[];
  odevler: Array<{ baslik: string; cozulen: number; soru_sayisi: number; son_tarih: string; bitti: boolean }>;
  rozetler: string[]; seviye: number | null; seri: number | null;
}

const GUN = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/** Veli görünümü: salt okunur haftalık özet. Düello, klan ve sohbet içeriği yok. */
export default function Veli() {
  const tema = useTema();
  const q = useQuery({
    queryKey: ["veli-ozet"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("veli_ozet");
      if (error) throw error;
      return (data ?? []) as Cocuk[];
    },
  });
  const cocuklar = q.data ?? [];
  return (
    <Ekran baslik={t("veli.baslik")} altBaslik={t("veli.not")}>
      <Stack.Screen options={{ headerShown: false }} />
      {q.isSuccess && cocuklar.length === 0 && <Kart><Metin soluk>{t("veli.bagliYok")}</Metin></Kart>}
      {cocuklar.map((c) => {
        const enCok = Math.max(1, ...c.gunler.map((g) => g.soru));
        return (
          <View key={c.id} style={{ gap: 14 }}>
            <Kart gradyan={GRADYAN.vurgu} sira={0}>
              <Metin tur="baslik" renk="#fff">{c.ad}</Metin>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                {c.seviye && <Etiket metin={`Seviye ${c.seviye}`} renk="#fff" />}
                {(c.seri ?? 0) > 0 && <Etiket metin={t("veli.seri", { n: c.seri ?? 0 })} renk={OYUN.altin} ikon={Flame} />}
              </View>
            </Kart>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[
                { ikon: Clock, renk: OYUN.buz, m: t("veli.dk", { n: c.hafta_dk ?? 0 }) },
                { ikon: Target, renk: tema.vurgu, m: t("veli.soru", { n: c.hafta_soru }) },
                { ikon: Star, renk: tema.dogru, m: t("veli.dogruluk", { n: c.dogruluk ?? 0 }) },
              ].map((x, i) => (
                <View key={i} style={{ flex: 1 }}>
                  <Kart sira={1 + i} ic={12}>
                    <IkonKutu ikon={x.ikon} renk={x.renk} boyut={34} />
                    <Metin tur="altbaslik" stil={{ fontSize: 16 }}>{x.m}</Metin>
                  </Kart>
                </View>
              ))}
            </View>
            <Kart sira={4}>
              <Bolum baslik={t("veli.calisma")} ikon={CalendarCheck} />
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: 6 }}>
                {c.gunler.map((g, i) => (
                  <View key={g.gun} style={{ flex: 1, alignItems: "center", gap: 4 }}>
                    <Metin tur="kucuk" soluk stil={{ fontSize: 10 }}>{g.soru || ""}</Metin>
                    <Animated.View entering={FadeInUp.delay(i * 60).springify()} style={{ width: "70%", height: Math.max(4, (g.soru / enCok) * 80), borderRadius: 6, backgroundColor: g.soru > 0 ? tema.vurgu : tema.kenar }} />
                    <Metin tur="kucuk" soluk stil={{ fontSize: 10 }}>{GUN[new Date(g.gun).getDay()]}</Metin>
                  </View>
                ))}
              </View>
            </Kart>
            <Kart sira={5} vurgu={tema.dogru}>
              <Bolum baslik={t("veli.guclu")} ikon={Star} />
              {c.guclu.length === 0 && <Metin soluk>-</Metin>}
              {c.guclu.map((x) => <Metin key={x} tur="kucuk">• {x}</Metin>)}
            </Kart>
            <Kart sira={6} vurgu={OYUN.altin}>
              <Bolum baslik={t("veli.gelisecek")} ikon={Sprout} />
              {c.gelisecek.length === 0 && <Metin soluk>-</Metin>}
              {c.gelisecek.map((x) => <Metin key={x} tur="kucuk">• {x}</Metin>)}
            </Kart>
            {c.odevler.length > 0 && (
              <Kart sira={7}>
                <Bolum baslik={t("veli.odevler")} ikon={CalendarCheck} />
                {c.odevler.map((o) => (
                  <View key={o.baslik + o.son_tarih} style={{ gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Metin tur="kucuk">{o.baslik}</Metin>
                      <Metin tur="kucuk" soluk>{o.cozulen}/{o.soru_sayisi}</Metin>
                    </View>
                    <Cubuk oran={o.cozulen / Math.max(1, o.soru_sayisi)} gradyan={GRADYAN.dogru} yukseklik={8} />
                  </View>
                ))}
              </Kart>
            )}
            {c.rozetler.length > 0 && (
              <Kart sira={8}>
                <Bolum baslik={t("veli.rozetler")} ikon={Star} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {c.rozetler.map((kod) => {
                    const r = ROZETLER.find((x) => x.kod === kod);
                    return (
                      <View key={kod} style={{ alignItems: "center", width: 80, gap: 4 }}>
                        <RozetMadalya kod={kod} kategori={r?.kategori ?? "soru"} boyut={52} />
                        <Metin tur="kucuk" ortala numberOfLines={2} stil={{ fontSize: 11 }}>{r?.ad ?? kod}</Metin>
                      </View>
                    );
                  })}
                </View>
              </Kart>
            )}
          </View>
        );
      })}
      <Dugme tur="hayalet" ikon={LogOut} baslik={t("giris.cikisYap")} onPress={() => void supabase.auth.signOut()} />
    </Ekran>
  );
}
