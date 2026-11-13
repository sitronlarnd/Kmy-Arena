import { OZELLIKLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Avatar } from "@/bilesenler/Avatar";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useOturum } from "@/lib/oturum";
import { useOyun } from "@/lib/oyun";
import { useIlerleme } from "@/lib/sorgular";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

export default function Profil() {
  const tema = useTema();
  const { profil, dershane } = useOturum();
  const i = useIlerleme().data;
  const oyun = useOyun().data;
  const oran = i && i.toplam_cevap > 0 ? Math.round((i.toplam_dogru / i.toplam_cevap) * 100) : 0;
  const enCok = Math.max(1, ...OZELLIKLER.map((o) => i?.ozellik_puanlari[o] ?? 0));
  return (
    <Ekran baslik={t("sekmeler.profil")}>
      <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
        {oyun && <Avatar tur={oyun.karakter?.tur} seviye={oyun.seviye} cerceve={oyun.karakter?.cerceve} arkaPlan={oyun.karakter?.arka_plan} kostum={oyun.karakter?.kostum} boyut={72} />}
        <View style={{ gap: 2 }}>
          <Text style={{ color: tema.metin, fontSize: 20, fontWeight: "700" }}>{profil?.takma_ad ?? "-"}</Text>
          {oyun?.karakter?.unvan && <Text style={{ color: tema.vurgu, fontWeight: "600" }}>{oyun.karakter.unvan}</Text>}
        </View>
      </View>
      <Text style={{ color: tema.soluk, fontSize: BOYUT.govde }}>{dershane?.ad ?? ""}</Text>
      {profil?.tur === "ogrenci" && i && (
        <>
          <Kart>
            <Text style={{ color: tema.metin, fontSize: 18, fontWeight: "800" }}>{t("arena.seviye", { n: i.seviye })} · {i.xp} {t("arena.xp")} · 🪙 {i.altin}</Text>
            <Text style={{ color: tema.soluk }}>{t("profil.toplamCevap")}: {i.toplam_cevap} · {t("profil.dogruOrani")}: %{oran}</Text>
          </Kart>
          <Kart>
            <Text style={{ color: tema.metin, fontWeight: "700" }}>{t("profil.ozellikler")}</Text>
            {OZELLIKLER.map((o) => {
              const p = i.ozellik_puanlari[o] ?? 0;
              return (
                <View key={o} style={{ gap: 4 }}>
                  <Text style={{ color: tema.metin }}>{t(`profil.ozellik.${o}`)} · {p}</Text>
                  <View style={{ height: 8, borderRadius: 4, backgroundColor: tema.kenar, overflow: "hidden" }}>
                    <View style={{ width: `${Math.round((p / enCok) * 100)}%`, height: 8, backgroundColor: tema.vurgu }} />
                  </View>
                </View>
              );
            })}
          </Kart>
        </>
      )}
      {profil?.tur === "ogrenci" && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Dugme ikincil baslik={`🎖️ ${t("oyun.rozetler")} (${oyun?.rozetler.length ?? 0})`} onPress={() => router.push("/rozetler")} />
          <Dugme ikincil baslik={`🃏 ${t("oyun.album")}`} onPress={() => router.push("/album")} />
          <Dugme ikincil baslik={`🛍️ ${t("oyun.magaza")}`} onPress={() => router.push("/magaza")} />
          <Dugme ikincil baslik={`🦉 ${t("oyun.karakterSec")}`} onPress={() => router.push("/karakter")} />
        </View>
      )}
      <Dugme ikincil baslik={t("giris.cikisYap")} onPress={() => void supabase.auth.signOut()} />
    </Ekran>
  );
}
