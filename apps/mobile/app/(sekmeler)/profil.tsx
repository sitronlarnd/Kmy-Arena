import { OZELLIKLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { Text, View } from "react-native";
import { Dugme } from "@/bilesenler/Dugme";
import { Ekran } from "@/bilesenler/Ekran";
import { Kart } from "@/bilesenler/Kart";
import { useOturum } from "@/lib/oturum";
import { useIlerleme } from "@/lib/sorgular";
import { supabase } from "@/lib/supabase";
import { BOYUT, useTema } from "@/lib/tema";

export default function Profil() {
  const tema = useTema();
  const { profil, dershane } = useOturum();
  const i = useIlerleme().data;
  const oran = i && i.toplam_cevap > 0 ? Math.round((i.toplam_dogru / i.toplam_cevap) * 100) : 0;
  const enCok = Math.max(1, ...OZELLIKLER.map((o) => i?.ozellik_puanlari[o] ?? 0));
  return (
    <Ekran baslik={t("sekmeler.profil")}>
      <Text style={{ color: tema.metin, fontSize: 20, fontWeight: "700" }}>{profil?.takma_ad ?? "-"}</Text>
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
      <Dugme ikincil baslik={t("giris.cikisYap")} onPress={() => void supabase.auth.signOut()} />
    </Ekran>
  );
}
