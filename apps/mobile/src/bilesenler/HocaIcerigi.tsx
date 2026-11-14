import type { CevapYaniti } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { GraduationCap, PlayCircle } from "lucide-react-native";
import { Linking, View } from "react-native";
import { MatematikMetni } from "./MatematikMetni";
import { Dugme, Kart, Metin } from "./ui";
import { BOYUT, OYUN, useTema } from "@/lib/tema";

/** Soru sonucunda: hocanın çözümü (öğretmen sorusu) ve kazanımın konu anlatımı kartları. */
export function HocaIcerigi({ sonuc }: { sonuc: CevapYaniti }) {
  const tema = useTema();
  const c = sonuc.hocaCozumu;
  const k = sonuc.konuAnlatimi;
  if (!c && !k) return null;
  return (
    <>
      {c && (
        <Kart vurgu={OYUN.altin}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GraduationCap size={20} color={OYUN.altin} />
            <Metin tur="altbaslik">{t("hoca.cozum")}</Metin>
          </View>
          {c.metin ? <MatematikMetni md={c.metin} renk={tema.metin} boyut={BOYUT.govde} /> : null}
          {c.url ? <Dugme kucuk tur="altin" ikon={PlayCircle} baslik={c.tur === "gorsel" ? t("hoca.gorselAc") : t("hoca.videoIzle")} onPress={() => void Linking.openURL(c.url ?? "")} /> : null}
        </Kart>
      )}
      {k && (
        <Kart vurgu={tema.vurgu}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PlayCircle size={20} color={tema.vurgu} />
            <View style={{ flex: 1 }}>
              <Metin tur="altbaslik">{t("hoca.konuAnlatimi")}</Metin>
              <Metin tur="kucuk" soluk>{k.baslik} · {k.ogretmen}</Metin>
            </View>
          </View>
          {k.metin ? <MatematikMetni md={k.metin} renk={tema.metin} boyut={BOYUT.govde} /> : null}
          {k.url ? <Dugme kucuk tur="ikincil" ikon={PlayCircle} baslik={t("hoca.izle")} onPress={() => void Linking.openURL(k.url ?? "")} /> : null}
        </Kart>
      )}
    </>
  );
}
