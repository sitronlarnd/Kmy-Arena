import { OZELLIKLER } from "@kmy/shared";
import { t } from "@kmy/shared/i18n";
import { router } from "expo-router";
import { Trash2, Award, BookOpen, Brain, Coins, Compass, LogOut, Palette, ShoppingBag, Sparkles, Target, Wind, Zap, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Ekran } from "@/bilesenler/Ekran";
import { Avatar } from "@/bilesenler/sanat";
import { Basilabilir, Bolum, Cubuk, Dugme, Etiket, Halka, IkonKutu, Kart, Metin } from "@/bilesenler/ui";
import { api } from "@/lib/api";
import { useOturum } from "@/lib/oturum";
import { useOyun } from "@/lib/oyun";
import { useIlerleme } from "@/lib/sorgular";
import { supabase } from "@/lib/supabase";
import { GRADYAN, OYUN, useTema } from "@/lib/tema";

const OZ: Record<string, { ikon: LucideIcon; renk: readonly [string, string] }> = {
  zeka: { ikon: Brain, renk: ["#A78BFA", "#7C3AED"] },
  enerji: { ikon: Zap, renk: ["#FFB36B", "#FF6A3D"] },
  bilgelik: { ikon: BookOpen, renk: ["#5EEAD4", "#0D9488"] },
  strateji: { ikon: Compass, renk: ["#7DB4FF", "#3B5BDB"] },
  ceviklik: { ikon: Wind, renk: ["#FF8FC8", "#DB2777"] },
};

export default function Profil() {
  const tema = useTema();
  const [silOnay, setSilOnay] = useState(false);
  const { profil, dershane } = useOturum();
  const i = useIlerleme().data;
  const oyun = useOyun().data;
  const oran = i && i.toplam_cevap > 0 ? i.toplam_dogru / i.toplam_cevap : 0;
  const enCok = Math.max(10, ...OZELLIKLER.map((o) => i?.ozellik_puanlari[o] ?? 0));
  return (
    <Ekran baslik={t("sekmeler.profil")}>
      <Kart gradyan={["#2A1F6B", tema.yuzey]} sira={0}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <Basilabilir onPress={() => router.push("/karakter")} etiket={t("oyun.karakter")}>
            <Avatar tur={oyun?.karakter?.tur} seviye={oyun?.seviye} cerceve={oyun?.karakter?.cerceve} arkaPlan={oyun?.karakter?.arka_plan} kostum={oyun?.karakter?.kostum} boyut={112} />
          </Basilabilir>
          <Metin tur="baslik">{profil?.takma_ad ?? "-"}</Metin>
          {oyun?.karakter?.unvan && <Etiket metin={oyun.karakter.unvan} renk={OYUN.xp} ikon={Award} />}
          <Metin tur="kucuk" soluk>{dershane?.ad ?? ""}</Metin>
        </View>
      </Kart>

      {profil?.tur === "ogrenci" && i && (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[
              { ikon: Sparkles, renk: OYUN.xp, deger: String(i.seviye), ad: t("profil.seviye") },
              { ikon: Target, renk: tema.dogru, deger: String(i.toplam_cevap), ad: t("profil.toplamCevap") },
              { ikon: Coins, renk: OYUN.altin, deger: String(i.altin), ad: t("oyun.altin") },
            ].map((x, j) => (
              <View key={x.ad} style={{ flex: 1 }}>
                <Kart sira={1 + j} ic={12}>
                  <IkonKutu ikon={x.ikon} renk={x.renk} boyut={36} />
                  <Metin tur="sayi">{x.deger}</Metin>
                  <Metin tur="kucuk" soluk numberOfLines={1}>{x.ad}</Metin>
                </Kart>
              </View>
            ))}
          </View>
          <Kart sira={4}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <Halka oran={oran} boyut={84} kalinlik={9} gradyan={GRADYAN.dogru}>
                <Metin tur="altbaslik">%{Math.round(oran * 100)}</Metin>
              </Halka>
              <View style={{ flex: 1 }}>
                <Metin tur="altbaslik">{t("profil.dogruOrani")}</Metin>
                <Metin tur="kucuk" soluk>{t("soru.dogruSayisi", { dogru: i.toplam_dogru, toplam: i.toplam_cevap })}</Metin>
              </View>
            </View>
          </Kart>
          <Bolum baslik={t("profil.ozellikler")} ikon={Sparkles} />
          <Kart sira={5}>
            {OZELLIKLER.map((o) => {
              const p = i.ozellik_puanlari[o] ?? 0;
              const z = OZ[o] ?? { ikon: Sparkles, renk: GRADYAN.vurgu };
              return (
                <View key={o} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <IkonKutu ikon={z.ikon} renk={z.renk[1]} boyut={38} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Metin>{t(`profil.ozellik.${o}`)}</Metin>
                      <Metin tur="kucuk" soluk>{p}</Metin>
                    </View>
                    <Cubuk oran={p / enCok} gradyan={z.renk} yukseklik={8} />
                  </View>
                </View>
              );
            })}
          </Kart>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Dugme kucuk genis={false} tur="ikincil" ikon={Award} baslik={`${t("oyun.rozetler")} · ${oyun?.rozetler.length ?? 0}`} onPress={() => router.push("/rozetler")} />
            <Dugme kucuk genis={false} tur="ikincil" ikon={Sparkles} baslik={t("oyun.album")} onPress={() => router.push("/album")} />
            <Dugme kucuk genis={false} tur="ikincil" ikon={ShoppingBag} baslik={t("oyun.magaza")} onPress={() => router.push("/magaza")} />
            <Dugme kucuk genis={false} tur="ikincil" ikon={Palette} baslik={t("oyun.karakterSec")} onPress={() => router.push("/karakter")} />
          </View>
        </>
      )}
      <Dugme tur="hayalet" ikon={LogOut} baslik={t("giris.cikisYap")} onPress={() => void supabase.auth.signOut()} />
      <Kart vurgu={tema.yanlis}>
        <Metin tur="kucuk" soluk>{t("profil.silmeAciklama")}</Metin>
        <Dugme kucuk tur={silOnay ? "tehlike" : "hayalet"} ikon={Trash2} baslik={silOnay ? t("profil.silmeOnay") : t("profil.hesabiSil")}
          onPress={() => (silOnay ? void api("/api/hesap/sil", {}).then(() => supabase.auth.signOut()) : setSilOnay(true))} />
      </Kart>
    </Ekran>
  );
}
