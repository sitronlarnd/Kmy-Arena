import { t } from "@kmy/shared/i18n";
import { Stack, router } from "expo-router";
import { Text } from "react-native";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { MatematikMetni } from "@/bilesenler/MatematikMetni";
import { useHataDefteri } from "@/lib/sorgular";
import { BOYUT, useTema } from "@/lib/tema";

export default function HataDefteri() {
  const tema = useTema();
  const { data = [] } = useHataDefteri();
  const vadesiGelen = data.filter((h) => h.vadesi_geldi).length;
  return (
    <Ekran baslik={t("hataDefteri.baslik")}>
      <Stack.Screen options={{ headerShown: true, title: t("hataDefteri.baslik"), headerStyle: { backgroundColor: tema.yuzey }, headerTintColor: tema.metin }} />
      {vadesiGelen > 0 && <Dugme baslik={t("arena.tekrarZamani", { n: vadesiGelen })} onPress={() => router.push({ pathname: "/soru", params: { mod: "tekrar" } })} />}
      {data.length === 0 && <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{t("hataDefteri.bos")}</Text>}
      {data.map((h) => (
        <Kart key={h.id} stil={h.vadesi_geldi ? { borderColor: tema.vurgu } : undefined}>
          <Text style={{ color: tema.soluk, fontSize: 13 }}>{h.ders} · {h.kazanim_kodu} · {t("hataDefteri.asama", { n: h.asama })}</Text>
          <MatematikMetni md={h.govde_md} renk={tema.metin} boyut={BOYUT.govde} />
          <Text style={{ color: tema.yanlis }}>{h.secilen ? t("hataDefteri.seninCevabin", { sik: h.secilen }) : t("hataDefteri.bosBiraktin")}</Text>
          <Text style={{ color: tema.dogru }}>{t("soru.dogruCevap", { sik: h.dogru })}</Text>
          <Text style={{ color: h.vadesi_geldi ? tema.vurgu : tema.soluk, fontSize: 13 }}>
            {h.vadesi_geldi ? t("hataDefteri.simdi") : t("hataDefteri.sonrakiTekrar", { tarih: new Date(h.sonraki_tekrar).toLocaleDateString("tr-TR") })}
          </Text>
        </Kart>
      ))}
    </Ekran>
  );
}
