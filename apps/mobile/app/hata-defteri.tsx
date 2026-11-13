import { t } from "@kmy/shared/i18n";
import { Stack, router } from "expo-router";
import { BookMarked, CalendarClock, Check, RotateCcw, X } from "lucide-react-native";
import { View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { Dugme, Etiket, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { useHataDefteri } from "@/lib/sorgular";
import { BOYUT, useTema } from "@/lib/tema";

const PEMBE = "#FF7AB6";

export default function HataDefteri() {
  const tema = useTema();
  const { data = [] } = useHataDefteri();
  const vadesiGelen = data.filter((h) => h.vadesi_geldi).length;
  return (
    <Ekran baslik={t("hataDefteri.baslik")} altBaslik={t("arena.tekrarAciklama")}>
      <Stack.Screen options={{ headerShown: false }} />
      {vadesiGelen > 0 && <Dugme buyuk ikon={RotateCcw} baslik={t("arena.tekrarZamani", { n: vadesiGelen })} onPress={() => router.push({ pathname: "/soru", params: { mod: "tekrar" } })} />}
      {data.length === 0 && (
        <Kart>
          <View style={{ alignItems: "center", gap: 10, paddingVertical: 12 }}>
            <IkonKutu ikon={BookMarked} renk={PEMBE} boyut={64} />
            <Metin soluk ortala>{t("hataDefteri.bos")}</Metin>
          </View>
        </Kart>
      )}
      {data.map((h, i) => (
        <Kart key={h.id} sira={Math.min(i, 8)} vurgu={h.vadesi_geldi ? PEMBE : undefined}>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <Etiket metin={h.ders} renk={tema.vurgu} />
            <Etiket metin={h.kazanim_kodu} renk={tema.soluk} />
            <View style={{ marginLeft: "auto", flexDirection: "row", gap: 3 }}>
              {[1, 2, 3, 4].map((n) => <View key={n} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n <= h.asama ? PEMBE : tema.kenar }} />)}
            </View>
          </View>
          <MatematikMetni md={h.govde_md} renk={tema.metin} boyut={BOYUT.govde} />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Etiket metin={h.secilen ? t("hataDefteri.seninCevabin", { sik: h.secilen }) : t("hataDefteri.bosBiraktin")} renk={tema.yanlis} ikon={X} />
            <Etiket metin={t("soru.dogruCevap", { sik: h.dogru })} renk={tema.dogru} ikon={Check} />
          </View>
          <Etiket
            metin={h.vadesi_geldi ? t("hataDefteri.simdi") : t("hataDefteri.sonrakiTekrar", { tarih: new Date(h.sonraki_tekrar).toLocaleDateString("tr-TR") })}
            renk={h.vadesi_geldi ? PEMBE : tema.soluk}
            ikon={CalendarClock}
          />
        </Kart>
      ))}
    </Ekran>
  );
}
