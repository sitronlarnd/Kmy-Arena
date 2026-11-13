import { t, type MetinAnahtari } from "@kmy/shared/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { ImagePlus, Send, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Image, ScrollView, TextInput, View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Cip, Dugme, Kart, Metin } from "@/bilesenler/ui";
import { api, ApiHatasi } from "@/lib/api";
import { gorselSec } from "@/lib/gorsel";
import { useMufredat } from "@/lib/sorgular";
import { BOYUT, useTema, yazi } from "@/lib/tema";

export default function ToplulukSor() {
  const tema = useTema();
  const qc = useQueryClient();
  const dersler = useMufredat().data ?? [];
  const [dersId, setDersId] = useState<string | null>(null);
  const [metin, setMetin] = useState("");
  const [gorsel, setGorsel] = useState<{ base64: string; uri: string } | null>(null);
  const [gorunurluk, setGorunurluk] = useState<"sinif" | "sube" | "dershane">("dershane");
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  const gonder = async () => {
    setYukleniyor(true);
    setHata(null);
    try {
      const y = await api<{ id: string }>("/api/topluluk/sor", { dersId, metin, gorunurluk, gorsel: gorsel?.base64 });
      await qc.invalidateQueries({ queryKey: ["topluluk"] });
      router.replace(`/topluluk/${y.id}`);
    } catch (h) {
      setHata(t((h instanceof ApiHatasi ? h.message : "ortak.hata") as MetinAnahtari));
    } finally {
      setYukleniyor(false);
    }
  };

  return (
    <Ekran baslik={t("topluluk.sor")}>
      <Stack.Screen options={{ headerShown: false }} />
      <Kart>
        <Metin tur="etiket" soluk>{t("topluluk.ders")}</Metin>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {dersler.map((d) => <Cip key={d.id} baslik={d.ad} secili={dersId === d.id} onPress={() => setDersId(d.id)} />)}
        </ScrollView>
        <Metin tur="etiket" soluk>{t("topluluk.metin")}</Metin>
        <TextInput
          value={metin}
          onChangeText={setMetin}
          multiline
          maxLength={2000}
          placeholder={t("topluluk.metinIpucu")}
          placeholderTextColor={tema.soluk}
          accessibilityLabel={t("topluluk.metin")}
          style={[yazi("kalin"), { minHeight: 140, textAlignVertical: "top", borderWidth: 2, borderColor: tema.kenar, borderRadius: 16, padding: 14, color: tema.metin, backgroundColor: tema.yuzey2, fontSize: BOYUT.govde }]}
        />
        {gorsel ? (
          <View style={{ gap: 8 }}>
            <Image source={{ uri: gorsel.uri }} style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: 16 }} resizeMode="cover" accessibilityLabel={t("fotograf.secilen")} />
            <Dugme kucuk tur="hayalet" ikon={Trash2} baslik={t("topluluk.fotografKaldir")} onPress={() => setGorsel(null)} />
          </View>
        ) : (
          <Dugme tur="ikincil" ikon={ImagePlus} baslik={t("topluluk.fotografEkle")} onPress={() => void gorselSec("galeri").then((g) => g && setGorsel(g))} />
        )}
        <Metin tur="etiket" soluk>{t("topluluk.kimGorsun")}</Metin>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {(["sinif", "sube", "dershane"] as const).map((g) => <Cip key={g} baslik={t(`topluluk.gorunurluk_${g}`)} secili={gorunurluk === g} onPress={() => setGorunurluk(g)} />)}
        </View>
      </Kart>
      {hata && <Metin renk={tema.yanlis}>{hata}</Metin>}
      <Dugme buyuk ikon={Send} baslik={t("topluluk.gonder")} yukleniyor={yukleniyor} pasif={!dersId || metin.trim().length < 5} onPress={() => void gonder()} />
    </Ekran>
  );
}
